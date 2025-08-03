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

const errReplacerFactory = (omitStack: boolean) => ( key: string, val: unknown ) => {
  if( val instanceof Error ) {
    return { name: val.name, message: val.message, stack: omitStack ? undefined : val.stack, cause: val.cause };
  }
  else { return val; }
};

const stringifyUnknown = ( unknown: unknown, omitStack = false, space = 2 ) => JSON.stringify(unknown, errReplacerFactory(omitStack) , space);

export const error = ( err: unknown ) => {
  if(isDebugMode()) {
    console.error(stringifyUnknown(err));
  }

  lspConsole.console?.error(stringifyUnknown(err, true));
};

export const info = ( value: string ) => {
  lspConsole.console?.info(value);
};

/** @description value could be an error */
export const warn = ( value: unknown ) => {
  if(isDebugMode()) {
    console.warn(stringifyUnknown(value));
  }

  lspConsole.console?.warn(stringifyUnknown(value, true));
};


