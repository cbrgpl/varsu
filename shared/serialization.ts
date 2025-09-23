export type LogLevels = 'MESSAGE' | "FULL";

interface SerializedError { _error: true; name: string; message: string; stack?: string[]; cause?: SerializedError | object | string }
const serializeError = ( error: Error, logLevel: LogLevels ) => {
  const serializedError: SerializedError = { _error: true, name: error.name, message: error.message };

  if( logLevel === 'FULL' && error.stack ) {
    serializedError.stack = error.stack.trim().split('\n');
  }

  if(error.cause) {
    serializedError.cause = error.cause instanceof Error ? serializeError(error.cause, logLevel) : typeof error.cause === 'object' ? error.cause : `${error.cause}`;
  }

  return serializedError;
};

const serialize = ( unknown: unknown, logLevel: LogLevels = 'MESSAGE', indent = 2 ) => {
  return JSON.stringify(unknown, (key: string, val: unknown) => val instanceof Error ? serializeError(val, logLevel) : val, indent);
};

const deserialize = ( unknown: string ): unknown => {
  return JSON.parse(unknown);
};

export { serialize, deserialize, type SerializedError };
