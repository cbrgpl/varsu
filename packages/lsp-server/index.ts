import * as ls from 'vscode-languageserver/node.js';
import * as lstd from 'vscode-languageserver-textdocument';

import * as constants from '@varsu/shared/constants.js';

import * as capabilities from './src/utils/capability-utils.js';
import * as configManagerNm from './src/core/config-manager.js';
import * as uriMapperNm from './src/core/uri-mapper.js';
import * as types from './src/types/index.js';
import { logger } from './src/utils/logger.js';

const CSS_VARIABLE_REGEXP = /--[A-Za-z0-9_-]+/g;

const findCssVariableAtPosition = (
  doc: lstd.TextDocument,
  position: ls.Position
): { variable: string; range: ls.Range } | null => {
  const docText = doc.getText();
  const offset = doc.offsetAt(position);
  CSS_VARIABLE_REGEXP.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = CSS_VARIABLE_REGEXP.exec(docText)) !== null) {
    const startOffset = match.index;
    const endOffset = startOffset + match[0].length;

    if (offset >= startOffset && offset <= endOffset) {
      return {
        variable: match[0],
        range: ls.Range.create(
          doc.positionAt(startOffset),
          doc.positionAt(endOffset)
        )
      };
    }
  }

  return null;
};

const connection = ls.createConnection(ls.ProposedFeatures.all);

logger.init(connection);

const documents = new ls.TextDocuments(lstd.TextDocument);

const fetchConfig: types.FetchConfig['fn'] = async ( uri ) => {
  try {
    const config = await connection.workspace.getConfiguration({
      scopeUri: uri,
      section: constants.EXT_NAME
    });

    if(config === null) {
      throw new Error(`configuration for "${uri}" is null`);
    }

    return {
      uri,
      config
    };
  } catch(err) {
    const errWrapper: types.FetchConfig['error'] = {
      uri: uri,
      err
    };

    throw errWrapper;
  }
};

connection.onInitialize(async (params: ls.InitializeParams) => {
  const hasConfigCapability = Boolean(
    params.capabilities.workspace && params.capabilities.workspace.configuration
  );
  const hasWorkspaceFolderCapability = Boolean(
    params.capabilities.workspace && params.capabilities.workspace.workspaceFolders
  );

  capabilities.capabilities.set(
    hasConfigCapability,
    hasWorkspaceFolderCapability,
  );

  const { configManager } = configManagerNm.initConfigManager(
    fetchConfig,
    params
  );

  uriMapperNm.initUriMapper( configManager.workspaceUris );

  const result: ls.InitializeResult = {
    capabilities: {
      textDocumentSync: ls.TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['(', '-'],
      },
      hoverProvider: true,
    }
  };

  if ( capabilities.capabilities.has('workspaceFolder') ) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});


connection.onInitialized(() => {
  const { configManager } = configManagerNm.getConfigManager();
  configManager.load();
});

documents.onDidClose(e => {
  const { uriMapper } = uriMapperNm.getUriMapper();
  uriMapper.scheduleRemoval( e.document.uri );
});

documents.onDidOpen(( e ) => {
  const { uriMapper } = uriMapperNm.getUriMapper();
  uriMapper.trackDocument(e.document.uri);
});

connection.onCompletion(
  (_textDocumentPosition: ls.TextDocumentPositionParams): ls.CompletionItem[] => {
    const docUri = _textDocumentPosition.textDocument.uri;

    const { uriMapper } = uriMapperNm.getUriMapper();
    const workspaceUri = uriMapper.getWorkspaceUri( docUri );

    if(!workspaceUri) { return []; }


    const { configManager } = configManagerNm.getConfigManager();
    const container = configManager.fetchConfigContainer( workspaceUri );

    if(!container?.cssSchema) {
      return [];
    }

    const doc = documents.get(_textDocumentPosition.textDocument.uri);
    if (!doc) {
      return [];
    }

    const position = _textDocumentPosition.position;
    const textBeforeCursor = doc.getText({
      start: { line: position.line, character: 0 },
      end: position
    });

    console.log(textBeforeCursor);

    if(!textBeforeCursor.includes('var')) { return []; }

    const completions = container.cssSchema.getCompletions();

    console.log(completions);

    if(!completions) {
      return [];
    }

    return completions;
  }
);

connection.onCompletionResolve((item) => {
  return item;
});

connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);

  if (!doc) {
    return null;
  }

  const variableMatch = findCssVariableAtPosition(doc, params.position);

  if (!variableMatch) {
    return null;
  }

  const { uriMapper } = uriMapperNm.getUriMapper();
  const workspaceUri = uriMapper.getWorkspaceUri(params.textDocument.uri);

  if (!workspaceUri) {
    return null;
  }

  const { configManager } = configManagerNm.getConfigManager();
  const container = configManager.fetchConfigContainer(workspaceUri);
  const schema = container?.cssSchema;

  if (!schema) {
    return null;
  }

  const details = schema.getVariableDetails(variableMatch.variable);

  if (!details) {
    return null;
  }

  const markdownSections: string[] = [];

  if (details.description) {
    markdownSections.push(details.description);
  }

  if (details.deprecated) {
    markdownSections.push(
      `\`[deprecated]\`${details.deprecatedDescription ? `: ${details.deprecatedDescription}` : ''}`
    );
  }

  const themeBlocks = details.themes.map((theme) => {
    const originalBlock = ['```css', theme.originalValue, '```'].join('\n');

    if (theme.value === theme.originalValue) {
      return [`**${theme.name}**`, `${originalBlock}` ].join('\n');
    }

    const resolvedBlock = ['```css', theme.value, '```'].join('\n');

    return [`**${theme.name}**`, originalBlock, resolvedBlock ].join('\n');
  });

  if (themeBlocks.length !== 0) {
    markdownSections.push(themeBlocks.join('\n\n'));
  }

  const contents: ls.MarkupContent = {
    kind: 'markdown',
    value: markdownSections.join('\n\n')
  };

  const hover: ls.Hover = {
    contents,
    range: variableMatch.range
  };

  return hover;
});

documents.listen(connection);
connection.listen();
