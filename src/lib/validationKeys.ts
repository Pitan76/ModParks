/**
 * zod スキーマに埋め込むバリデーション文言の翻訳キー。
 *
 * スキーマはサーバ・クライアント双方から使われ、その場に翻訳関数が無い。
 * そこでメッセージ本体ではなく翻訳キーを載せ、表示する側（useValidationMessage）で解決する。
 * 接頭辞は、翻訳キーではない素の文字列（外部APIのエラー等）と区別するための目印。
 */
export const VALIDATION_KEY_PREFIX = "Validation.";

/** lang/*.json の Validation ネームスペースに対応するキー */
export type ValidationKey =
  | "slugFormat"
  | "slugReserved"
  | "slugTaken"
  | "nameMin"
  | "nameMax"
  | "descriptionMin"
  | "descriptionMax"
  | "licenseRequired"
  | "licenseMax"
  | "invalidUrl"
  | "tagsMax"
  | "versionNumberFormat"
  | "titleMin"
  | "titleMax"
  | "ideaContentMin"
  | "ideaContentMax"
  | "commentMin"
  | "commentMax"
  | "dependencyTargetRequired";

/** zod スキーマに渡す翻訳キー付きメッセージを組み立てる */
export const vk = (key: ValidationKey): string => `${VALIDATION_KEY_PREFIX}${key}`;
