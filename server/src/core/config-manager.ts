import * as ls from 'vscode-languageserver/node';
import * as capabilities from '../utils/capability-utils';
import * as cssSchema from './css-schema';
import * as types from './../types';
import { logger } from '../utils/logger';

/** @description Container for configs */
interface IConfigContainer {
  config: types.IConfig,
  cssSchema: cssSchema.CssSchema | null
}

class ConfigManager {
  private _initParams: ls.InitializeParams;
  private _fetchConfig: types.FetchConfig['fn'];

  /** @description Workspace uris used as keys */
  private _containers = new Map<string, IConfigContainer>();

  /** @description loaded workspace uris */
  public readonly workspaceUris: string[];

  constructor( fetchConfig: types.FetchConfig['fn'], initParams: ls.InitializeParams ) {
    this._fetchConfig = fetchConfig;
    this._initParams = initParams;
    this.workspaceUris = this._getWorkspaceUris();
  }

  /** @description Used to get settings container for workspace */
  fetchConfigContainer( workspaceUri: string ): null | IConfigContainer {
    return this._containers.get( workspaceUri ) ?? null;
  }

  private _getWorkspaceUris(): string[] {
    if(capabilities.capabilities.has('workspaceFolder')) {
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

      rejects.forEach( result => {
        const {err, uri}: types.FetchConfig['error'] = result.reason;
        logger.warn(
          new Error(`Failed to load configuration from "${uri}"`, { cause: err })
        );
      } );
    }

    const configs = results.filter( result =>  result.status === 'fulfilled' ).map( res => res.value );
    for(const { config, uri } of configs ) {
      this._containers.set(uri, {
        'config': config,
        cssSchema: new cssSchema.CssSchema(config)
      });
    }
  }
}

let manager: null | ConfigManager = null;
export const initConfigManager = ( fetchConfig: types.FetchConfig['fn'], intiParams: ls.InitializeParams) => {
  manager = new ConfigManager( fetchConfig, intiParams );
  return { configManager: manager };
};
export const getConfigManager = () => {
  if(!manager) { throw new Error('ConfigManger have not been initialized yet');}

  return { configManager: manager };
};
