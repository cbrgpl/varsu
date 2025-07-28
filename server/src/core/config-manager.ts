import { type InitializeParams } from 'vscode-languageserver/node';
import { capabilities } from '../utils/capability-utils';

import { CssSchema } from './css-schema';
import { FetchConfig, IConfig } from '../types';

/** @description Container for configs */
interface IConfigContainer {
  config: IConfig,
  cssSchema: CssSchema | null
}

class ConfigManager {
  private _initParams: InitializeParams;
  private _fetchConfig: FetchConfig;

  /** @description Workspace uris used as keys */
  private _containers = new Map<string, IConfigContainer>();

  /** @description loaded workspace uris */
  public readonly workspaceUris: string[];

  constructor( fetchConfig: FetchConfig, initParams: InitializeParams ) {
    this._fetchConfig = fetchConfig;
    this._initParams = initParams;
    this.workspaceUris = this._getWorkspaceUris();
  }

  /** @description Used to get settings container for workspace */
  fetchConfigContainer( workspaceUri: string ): null | IConfigContainer {
    return this._containers.get( workspaceUri ) ?? null;
  }

  private _getWorkspaceUris(): string[] {
    if(capabilities.has('workspaceFolder')) {
      return this._initParams.workspaceFolders!.map( folder => folder.uri );
    } else if(this._initParams.rootUri) {
      /** @deprecated */
      return [ this._initParams.rootUri ];
    } else if(this._initParams.rootPath) {
      /** @deprecated */
      return [ this._initParams.rootPath ];
    }

    throw new Error('Failed to get workspace uri');
  }

  /** @description Called in onInitialized hook. Used for preload configs for all workspaces */
  public async load(): Promise<void> {
    const promises = this.workspaceUris.map( uri => this._fetchConfig( uri ) );
    const results = await Promise.allSettled(promises);

    const rejects = results.filter( result => result.status === 'rejected' );
    if(rejects.length !== 0) {
      console.group(`Failed to load ${rejects.length} configs`);
      rejects.forEach( result => {
        console.log('---');
        const uri = (result.reason as { uri: string}).uri;
        console.log(uri);
        console.log(result.reason.error);
        console.log('---');
      } );
      console.groupEnd();
    }

    const configs = results.filter( result =>  result.status === 'fulfilled' ).map( res => res.value );
    for(const { config, uri } of configs ) {
      this._containers.set(uri, {
        'config': config,
        cssSchema: new CssSchema(config)
      });
    }
  }
}

let manager: null | ConfigManager = null;
export const initConfigManager = ( fetchConfig: FetchConfig, intiParams: InitializeParams) => {
  manager = new ConfigManager( fetchConfig, intiParams );
  return { configManager: manager };
};
export const getConfigManager = () => {
  if(!manager) { throw new Error('ConfigManger have not been initialized yet');}

  return { configManager: manager };
};
