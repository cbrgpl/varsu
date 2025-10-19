import * as ls from 'vscode-languageserver/node.js';
import * as csstree from 'css-tree';
import * as types from '../types/index.js';
import { logger } from '../utils/logger.js';

/** @description Contains metadata for css var */
interface ICssVarMetadata {
  name: string;
  value: string;
  description?: string;
  deprecated: boolean;
  deprecatedDescription?: string;
}

interface ICssVarThemesSnapshot {
  name: string;
  value: string;
  originalValue: string;
}

interface ICssVarDetails {
  name: string;
  description?: string;
  deprecated: boolean;
  deprecatedDescription?: string;
  themes: ICssVarThemesSnapshot[];
}

/** @description Config params used by css schema */
type CssSchemaConfig = Pick<types.IConfig, 'sourceUrl' | "themes">;

/** @description used for searching of "@deprecated" flag for css var */
const CSS_DEPRECATED_KEYWORD = "@deprecated";

/** @description used for searching "@description" flag for css var */
const CSS_DESCRIPTION_KEYWORD = "@description";

const CSS_KEYWORD_VALUE_REGEXP = /.+?(?=(@deprecated|@description|$))/;

const FETCH_TIMEOUT_MS = 5000;
const FETCH_RETRY_COUNT = 3;

export class CssSchema implements types.ISuggestingSchema {
  /** @description Keys are theme names */
  private _themeGraphs = new Map<string, DependencyGraph>();

  constructor( config: CssSchemaConfig ) {
    this._loadSchema( config.sourceUrl, config.themes );
  }

  getCompletions( partialVarName: string ): ls.CompletionItem[] | null {
    const inputedVarName = '--' + partialVarName.replace(/^--/, '');

    const completions = new Map<string, ls.CompletionItem>();

    for(const [ theme, graph ] of this._themeGraphs.entries()) {
      for(const key of graph.nodes.keys()) {
        if(key.startsWith(inputedVarName)) {
          const completion: ls.CompletionItem = completions.get(key) ?? {
            label: key,
            kind: ls.CompletionItemKind.Variable,
            documentation: {
              kind: 'markdown',
              value: ''
            }
          };

          const node =  graph.nodes.get(key);
          if(!node) { continue; }

          const isFirstThemeOccurrence = !completions.has(key);
          // NOTE Shows @description and @deprecated in completion ONLY ONCE FROM THE FIRST THEME CONTAINING VARIABLE
          if(isFirstThemeOccurrence) {
            completion.detail = node.metadata.description
            ;(completion.documentation as ls.MarkupContent).value += node.metadata.deprecated ? `\`[deprecated]: ${node.metadata.deprecatedDescription}\`\n\n` : "\n\n";
          }

          const value = node.value;

          /** @description If value uses another value value will be different */
          const isVariableComplex = value !== node.metadata.value;

          ;(completion.documentation as ls.MarkupContent).value += `\n\n**\`${theme}:\`**\n
${ isVariableComplex ? node.metadata.value + '\n\n' : '' }${value}`;

          completions.set(key, completion);
        }
      }
    }

    return Array.from(completions.values());
  }

  getVariableDetails( varName: string ): ICssVarDetails | null {
    const normalizedVarName = varName.startsWith('--') ? varName : `--${varName}`;

    let baseMetadata: ICssVarMetadata | null = null;
    const themes: ICssVarThemesSnapshot[] = [];

    for(const [ themeName, graph ] of this._themeGraphs.entries()) {
      const node = graph.nodes.get(normalizedVarName);
      if(!node) {
        continue;
      }

      if(!baseMetadata) {
        baseMetadata = node.metadata;
      }

      themes.push({
        name: themeName,
        value: node.value,
        originalValue: node.metadata.value,
      });
    }

    if(!baseMetadata) {
      return null;
    }

    return {
      name: normalizedVarName,
      description: baseMetadata.description,
      deprecated: baseMetadata.deprecated,
      deprecatedDescription: baseMetadata.deprecatedDescription,
      themes,
    };
  }

  private async _loadSchema( url: string, themes: types.ICssTheme[] ): Promise<void> {
    try {
      const css = await this._fetchFileContent(url);

      for(const theme of themes) {
        const graph = this._createGraph(css, theme.selector);
        this._themeGraphs.set(theme.name, graph);
      }
    } catch(err) {
      logger.error(err);
    }
  }

  private async _fetchFileContent( url: string ): Promise<string> {
    for(let attempt = 0; attempt < FETCH_RETRY_COUNT; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        // NOTE protocol MUST BE defined; https://some.domain.com, http://localhost:3005
        const res = await fetch( url, { method: 'GET', signal: controller.signal } );

        if(res.status === 200) {
          return await res.text();
        }

        throw new Error(`Unexpected response status "${res.status}" while loading css file content`);
      } catch(err) {
        if(attempt === FETCH_RETRY_COUNT - 1) {
          if(err instanceof Error && err.name === 'AbortError') {
            throw new Error(`Request to "${url}" timed out`, { cause: err });
          }

          if(err instanceof Error && err.name === 'TypeError' && err.message === 'fetch failed') {
            throw new Error(`Failed to fetch css file from url "${url}"`, { cause: err.cause });
          }

          throw new Error(`Caught unknown error while loading css file`, { cause: err });
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(`Failed to fetch css file from url "${url}"`);
  }

  private _createGraph( css: string, selector: string ) {
    /** @description key is end str number */
    const comments = new Map<number, { value: string, loc: csstree.CssLocation}>();
    const ast = csstree.parse(css, { positions: true, onComment(value, loc) {
      if(value.includes(CSS_DEPRECATED_KEYWORD) || value.includes(CSS_DESCRIPTION_KEYWORD)) {
        comments.set(loc.end.line, { value, loc });
      }
    }, });

    const metadataList: ICssVarMetadata[] = [];

    csstree.walk(ast, {
      visit: 'Rule',
      enter(node: csstree.CssNode) {
        if (
          node.type === 'Rule' &&
        csstree.generate(node.prelude).trim() === selector &&
        node.block.type === 'Block'
        ) {
          for (const declaration of Array.from(node.block.children)) {
            if (
              declaration.type === 'Declaration' &&
            declaration.property.startsWith('--')
            ) {
              const cssVarMetadata: ICssVarMetadata = {
                name: declaration.property,
                value: csstree.generate(declaration.value).trim(),
                deprecated: false,
              };

              if(declaration.loc) {
                const comment = comments.get(declaration.loc.start.line - 1);

                if(comment) {
                  const deprecatedIndex = comment.value.indexOf(CSS_DEPRECATED_KEYWORD);
                  const descriptionIndex = comment.value.indexOf(CSS_DESCRIPTION_KEYWORD);

                  if(deprecatedIndex !== -1) {
                    cssVarMetadata.deprecated = true;
                    cssVarMetadata.deprecatedDescription = comment.value.slice(deprecatedIndex).replace(CSS_DEPRECATED_KEYWORD, '').match(CSS_KEYWORD_VALUE_REGEXP)?.[0].trim() ?? undefined;
                  }

                  if(descriptionIndex !== -1) {
                    cssVarMetadata.description = comment.value.slice(descriptionIndex).replace(CSS_DESCRIPTION_KEYWORD, '').match(CSS_KEYWORD_VALUE_REGEXP)?.[0].trim() ?? undefined;
                  }
                }
              }

              metadataList.push(cssVarMetadata);
            }
          }
        }
      },
    });

    return new DependencyGraph(metadataList);
  };
}

class CssVarNode {
  public readonly metadata: ICssVarMetadata;

  /** @description nodes which used by current node */
  public dependsOn = new Set<InstanceType<typeof CssVarNode>>();

  /** @description nodes which use current node */
  public dependents = new Set<InstanceType<typeof CssVarNode>>();

  constructor( metadata: ICssVarMetadata ) {
    this.metadata = metadata;
  }

  public get value() {
    let val = this.metadata.value;

    for(const dependent of this.dependsOn) {
      val = val.replace(`var(${dependent.metadata.name})`, dependent.value);
    }

    return val;
  }
}

/** @description matches var(--.+) */
const CSS_USED_VAR  = /(?<=var\()--.+?(?=[,)])/g;

export class DependencyGraph {
  public nodes = new Map<string, CssVarNode>();
  private _vars: ICssVarMetadata[];

  constructor( vars: ICssVarMetadata[] ) {
    this._vars = vars;

    for(const variable of vars) {
      this._resolveVar(variable);
    }
  }

  private _resolveVar( variable: ICssVarMetadata, toBeResolved: Record<string, true> = {} ) {
    // resolved recursively while resolving another var
    if(this.nodes.has(variable.name)) {
      return;
    }

    const node = new CssVarNode( variable );

    const usedVarsNames = variable.value.matchAll(CSS_USED_VAR).toArray().map( v => v[0] );
    const usedVars = this._vars.filter( variable => usedVarsNames.includes(variable.name));

    if(usedVars.length) {
      for(const usedVar of usedVars ) {

        const circularDep = usedVarsNames.find( (name) => toBeResolved[name] ) ?? null;
        if( circularDep ) {
          logger.warn( new Error(`Circular dependency for "${circularDep}" and "${node.metadata.name}" is detected`, { cause: [ node.metadata.name, circularDep ] }));
          return;
        }

        if(!this.nodes.get(usedVar.name)) {
          this._resolveVar(usedVar, {...toBeResolved, [node.metadata.name]: true });
        }

        const usedVarnode = this.nodes.get(usedVar.name);

        if(usedVarnode) {
          node.dependsOn.add(usedVarnode);
          usedVarnode.dependents.add(node);
        }


      }
    }


    this.nodes.set(variable.name, node);
  }

}
