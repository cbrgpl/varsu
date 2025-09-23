
declare namespace NodeJS {
  interface ProcessEnv {
    VSCODE_DEBUG_MODE?: 'true' | 'false';
    VSCODE_LOG_LEVEL?: import('./serialization.ts').LogLevels
  }
}
