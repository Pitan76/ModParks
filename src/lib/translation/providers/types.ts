/**
 * 翻訳プロバイダの境界。モデルを差し替えても呼び出し側が変わらないよう、
 * 受け渡しは「行番号付きテキスト」だけに限定する。
 */
export interface TranslationRequest {
  /** 行番号付きのマスク済み本文 */
  payload: string;
  sourceLocale: string;
  targetLocale: string;
}

export interface TranslationProvider {
  /** translation_runs に記録する識別子 */
  readonly name: string;
  readonly model: string;
  /** @returns LLM の生の応答。整形・検証は呼び出し側で行う */
  translate(req: TranslationRequest): Promise<string>;
}
