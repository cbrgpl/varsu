import { EXT_NAME } from '../../../shared/constants';
import { type CompletionItem } from 'vscode-languageserver';

/** @description Schema which suggests something */
export interface ISuggestingSchema {
  getCompletions( valueToFilter: string ): CompletionItem[] | null
}

/** @description Css theme data */
export interface ICssTheme {"selector": string; name: string;}


/** @description Defines in editor/IDE settings file */
export type ISettings<T extends Record<string, unknown> = {
  ['sourceUrl']: string;
  ['themes']: ICssTheme[]
}> = {
  [ Key in keyof T as Key extends string ? `${typeof EXT_NAME}.${Key}` : never ]: T[Key]
};

type _OmitSubStr<T extends string, SubStr extends string = ''> = T extends `${SubStr}${infer Str}` ? Str : T;

/** @description Configuration object with ext. params */
export type IConfig = {
  [Key in keyof ISettings as Key extends string ? _OmitSubStr<Key, `${typeof EXT_NAME}.`> : Key]: ISettings[Key]
};

/** @description Resolves IConfig for document uri */
export type FetchConfig = ( uri: string ) => Promise<{ uri: string, config: IConfig } >;
