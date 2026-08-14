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

/**
 * トークンの表記。
 *
 * 記号は ASCII の自己終了タグ風にしている。⟦⟧ のような非 ASCII は小さいモデルが
 * 全角化・削除しやすく、実運用で復元に失敗したため。タグ形は「訳してはいけない
 * 記号」として扱われやすく、そのまま返ってくる率が高い。
 */
export const tokenRef = (index: number): string => `<x${index}/>`;

/** 訳文中のトークンを拾う。閉じ記号の揺れ（`< x0 />`）も許容する */
export const TOKEN_PATTERN = /<\s*x(\d+)\s*\/?\s*>/g;

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
