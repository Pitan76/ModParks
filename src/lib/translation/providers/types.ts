/**
 * 翻訳プロバイダの境界。モデルを差し替えても呼び出し側が変わらないよう、
 * 受け渡しは「行番号付きテキスト」だけに限定する。
 */
export interface TranslationRequest {
  /** 行番号付きのマスク済み本文 */
  payload: string;
  sourceLocale: string;
  targetLocale: string;
  /** 再試行時。書式の指示をより強く出す */
  strict?: boolean;
  /** 使用するモデル。管理画面から変更できる */
  model: string;
  /** 1 回の生成で出力させる上限トークン */
  maxTokens: number;
}

export interface TranslationProvider {
  /** translation_runs に記録する識別子 */
  readonly name: string;
  /** 管理画面で未設定の場合に使うモデル */
  readonly defaultModel: string;
  /** @returns LLM の生の応答。整形・検証は呼び出し側で行う */
  translate(req: TranslationRequest): Promise<string>;
}
