import type { _Connection } from 'vscode-languageserver/node.js';
import { LogLevels, serialize } from '@varsu/shared/serialization.js';

class Logger {
  private _lspConsole: _Connection['console'] | null = null;

  public init( connection: _Connection ) {
    if(this._lspConsole) {
      console.warn("[Logger] Already initialized, ignoring re-init");
      return;
    }
    this._lspConsole = connection.console;
  }

  private _log( type: 'error' | "warn" | "info", payload: unknown ) {
    if(!this._lspConsole) {
      console[type]('[Logger] Not initialized, fallback log:', payload);

      return;
    }

    const serializedPayload = serialize(payload, (process.env.VSCODE_LOG_LEVEL ?? "MESSAGE") as LogLevels );
    const messageTitle = payload instanceof Error ? `${payload.name}:\n` : '\n';
    const message = `${messageTitle}${serializedPayload}`;

    switch(type) {
    case 'error':
      this._lspConsole.error(message);
      return;
    case 'info':
      this._lspConsole.info(message);
      return;
    case 'warn':
      this._lspConsole.warn(message);
      return;
    }
  }

  public error( err: unknown ) {
    this._log('error', err);
  }

  public warn( payload: unknown ) {
    this._log('warn', payload );
  }

  public info( payload: unknown ) {
    this._log('info', payload);
  }
};

const logger = new Logger();

export {
  logger
};
