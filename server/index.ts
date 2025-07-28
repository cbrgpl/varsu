import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  CompletionItem,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
} from 'vscode-languageserver/node';

import {
  TextDocument
} from 'vscode-languageserver-textdocument';

import { capabilities } from './src/utils/capability-utils';
import { getConfigManager, initConfigManager } from './src/core/config-manager';
import { getUriMapper, initUriMapper } from './src/core/uri-mapper';
import { type FetchConfig } from './src/types';

import * as lspConsole from './src/utils/lsp-console';

import { EXT_NAME } from '../shared/constants';

/** @description matches at least var( at most var(..., where ... inputed var name */
const COMPLETION_TRIGGER_REGEXP = /.*var\(([^)]+)?$/;

const connection = createConnection(ProposedFeatures.all);

lspConsole.initLspConsole(connection);

const documents = new TextDocuments(TextDocument);

const fetchConfig: FetchConfig['fn'] = async ( uri ) => {
  try {
    const config = await connection.workspace.getConfiguration({
      scopeUri: uri,
      section: EXT_NAME
    });

    if(config === null) {
      throw new Error(`configuration for "${uri}" is null`);
    }

    return {
      uri,
      config
    };
  } catch(err) {
    const errWrapper: FetchConfig['error'] = {
      uri: uri,
      err
    };

    throw errWrapper;
  }
};

connection.onInitialize(async (params: InitializeParams) => {
  console.log('onInitialize');
  const hasConfigCapability = Boolean(
    params.capabilities.workspace && params.capabilities.workspace.configuration
  );
  const hasWorkspaceFolderCapability = Boolean(
    params.capabilities.workspace && params.capabilities.workspace.workspaceFolders
  );

  capabilities.set(
    hasConfigCapability,
    hasWorkspaceFolderCapability,
  );

  const { configManager } = initConfigManager(
    fetchConfig,
    params );

  console.log(configManager);

  initUriMapper( configManager.workspaceUris );

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['(', '-'],
      },
      // diagnosticProvider: {
      //   interFileDependencies: false,
      //   workspaceDiagnostics: false
      // }
    }
  };

  if ( capabilities.has('workspaceFolder') ) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true
      }
    };
  }

  return result;
});


connection.onInitialized(() => {
  const { configManager } = getConfigManager();
  configManager.load();

  // if (hasCapability('configuration')) {
  //   // Register for all configuration changes.
  //   connection.client.register(DidChangeConfigNotification.type, undefined);
  // }
  // if (hasCapability('workspaceFolder')) {
  //   connection.workspace.onDidChangeWorkspaceFolders(_event => {
  //     connection.console.log('Workspace folder change event received.');
  //   });
  // }
});

documents.onDidClose(e => {
  const { uriMapper } = getUriMapper();
  uriMapper.scheduleRemoval( e.document.uri );
});

documents.onDidOpen(( e ) => {
  const { uriMapper } = getUriMapper();
  uriMapper.trackDocument(e.document.uri);
});

connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const docUri = _textDocumentPosition.textDocument.uri;
    console.log(docUri);

    const { uriMapper } = getUriMapper();
    const workspaceUri = uriMapper.getWorkspaceUri( docUri );

    if(!workspaceUri) { return []; }

    const { configManager } = getConfigManager();
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

    console.log(COMPLETION_TRIGGER_REGEXP.test(textBeforeCursor), position, textBeforeCursor);

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
