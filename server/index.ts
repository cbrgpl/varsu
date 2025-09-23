import * as ls from 'vscode-languageserver/node.js';
import * as lstd from 'vscode-languageserver-textdocument';

import * as constants from './../shared/constants.js';

import * as capabilities from './src/utils/capability-utils.js';
import * as configManagerNm from './src/core/config-manager.js';
import * as uriMapperNm from './src/core/uri-mapper.js';
import * as types from './src/types/index.js';
import { logger } from './src/utils/logger.js';

/** @description matches at least var( at most var(..., where ... inputed var name */
const COMPLETION_TRIGGER_REGEXP = /.*var\(([^)]+)?$/;

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

    const inputedVar = textBeforeCursor.match(COMPLETION_TRIGGER_REGEXP);

    if(inputedVar !== null) {
      const cssCompletions = container.cssSchema.getCompletions( inputedVar[1] ?? '' );

      if(!cssCompletions) {
        return [];
      }

      return cssCompletions;
    }


    return [];
  }
);

connection.onCompletionResolve((item) => {
  return item;
});

documents.listen(connection);
connection.listen();
