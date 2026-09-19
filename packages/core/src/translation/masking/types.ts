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

/** 置換した原文の断片 */
export interface MaskedToken {
  text: string;
  /**
   * 行内での位置が意味を持つか。
   * 表のセル区切りのように、順序が変わると構造が壊れるものだけ true にする。
   * 行内記法（リンク・コード・URL）は翻訳で語順が変わるため false。
   */
  ordered: boolean;
}

export interface MaskedDocument {
  lines: MaskedLine[];
  /** <x{i}/> の i 番目に対応する原文断片 */
  tokens: MaskedToken[];
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
  private readonly items: MaskedToken[] = [];

  /**
   * @param ordered 行内での位置が意味を持つ場合に true（表のセル区切りなど）
   * @returns 差し込むべきトークン参照
   */
  add(fragment: string, ordered = false): string {
    this.items.push({ text: fragment, ordered });
    return tokenRef(this.items.length - 1);
  }

  toArray(): MaskedToken[] {
    return [...this.items];
  }
}
