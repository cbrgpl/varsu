import * as path from 'path';
import * as vscode from 'vscode';

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';
import { EXT_NAME } from '../shared/constants';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server', 'index.js')
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'css' },
      { scheme: 'file', language: 'scss' },
      { scheme: 'file', language: 'less' },
      { scheme: 'file', language: 'postcss' },
      { scheme: 'file', language: 'vue' },
      { scheme: 'file', language: 'svelte' },
      { scheme: 'file', language: 'javascriptreact' },
      { scheme: 'file', language: 'typescriptreact' }
    ],
    synchronize: {
      configurationSection: [EXT_NAME],
    },
  };

  client = new LanguageClient(
    EXT_NAME,
    'VarSu',
    serverOptions,
    clientOptions
  );

  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
