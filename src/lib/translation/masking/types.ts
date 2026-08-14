/**
 * 記法マスキングの共通型。LLM には「行頭マーカーを剥がし、記法をトークンに
 * 置換した本文」だけを渡し、復元と検証はこちら側で行う。
 */

/** マスク後の 1 行 */
export interface MaskedLine {
  /** 行頭記法（`## ` `- ` `|` など）。LLM には渡さず復元時に再付与する */
  marker: string;
  /** 本文。translatable な行はトークンを含んだ翻訳対象テキスト */
  text: string;
  /** false の行（コードブロック内など）はそのまま出力し翻訳しない */
  translatable: boolean;
}

export interface MaskedDocument {
  lines: MaskedLine[];
  /** ⟦T{i}⟧ の i 番目に対応する原文断片 */
  tokens: string[];
}

export interface FormatMasker {
  mask(text: string): MaskedDocument;
}

/** トークンの表記。翻訳対象テキストに出現しない字を選ぶ */
export const TOKEN_OPEN  = "⟦";
export const TOKEN_CLOSE = "⟧";

export const tokenRef = (index: number): string => `${TOKEN_OPEN}T${index}${TOKEN_CLOSE}`;

/** 置換した原文断片を貯め、トークン参照を払い出す */
export class TokenBag {
  private readonly items: string[] = [];

  /** @returns 差し込むべきトークン参照 */
  add(fragment: string): string {
    this.items.push(fragment);
    return tokenRef(this.items.length - 1);
  }

  toArray(): string[] {
    return [...this.items];
  }
}
