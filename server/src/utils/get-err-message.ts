export const getErrMessage = ( err :unknown ) => {
  if(typeof err === 'string' ) {
    return err;
  } else if(err?.toString) {
    return err.toString() as string;
  } else if(err instanceof Error) {
    return err.message;
  } else {
    return `${err}`;
  }
};
