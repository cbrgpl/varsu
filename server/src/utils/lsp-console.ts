import type * as ls from 'vscode-languageserver/node';

const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === 'true';

const lspConsole = new class {
  private _console: ls._Connection['console'] | null = null;

  public set console(v: ls._Connection['console'] | null) {
    if(this._console === null) {
      this._console = v;
    } else {
      console.error('lspConsole already have been initialized. It\'s not able to reinitialize it');
    }
  }

  public get console(): ls._Connection['console'] | null {
    if(this._console) {
      return this._console;
    } else if(isDebugMode()) {
      console.error('consoleWrapper.console is accessed before initialization');
    }

    return null;
  }
};

export const initLspConsole = ( connection: ls._Connection ) => {
  lspConsole.console = connection.console;
};

const addTabulation = ( value: string, level: number ) => value.split('\n').map(( line ) => `${'\t'.repeat(level)}${line}` ).join('\n');
const prepareForProd = ( err: unknown, messages: string[] = [], level = 0 ): string => {
  if(err instanceof Error) {
    const msg = addTabulation(`[${err.name}]: ${err.message}`, level);
    messages.push(msg);

    if(err.cause instanceof Error) {
      prepareForProd(err.cause, messages, level + 1);
    } else {
      messages.push(addTabulation(`[cause]: ${JSON.stringify(err.cause)}`, level + 1));
    }

    return messages.join('\n');
  }

  return JSON.stringify(err, null, 2);
};

const errReplacer = ( key: string, val: unknown ) => {
  if( val instanceof Error ) {
    return { name: val.name, message: val.message, stack: val.stack, cause: val.cause };
  }

  else { return val; }
};

const stringifyUnknown = ( unknown: unknown, space = 2 ) =>  isDebugMode() ? JSON.stringify(unknown, errReplacer , space).replaceAll('\\n', '\n') : prepareForProd(unknown);

export const error = ( err: unknown ) => {
  if(isDebugMode()) {
    console.error(stringifyUnknown(err));
  }

  lspConsole.console?.error(stringifyUnknown(err));
};

export const info = ( value: string ) => {
  lspConsole.console?.info(value);
};

/** @description value could be an error */
export const warn = ( value: unknown ) => {
  if(isDebugMode()) {
    console.warn(stringifyUnknown(value));
  }

  lspConsole.console?.warn(stringifyUnknown(value));
};


