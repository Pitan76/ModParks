/**
 * カード等の一覧表示向けに、Markdown/HTMLを含む説明文から
 * 見出し・箇条書き記号・HTMLタグを取り除き、プレーンなテキスト行のみを抽出します。
 */

/** HTMLタグを除去し、代表的なHTMLエンティティを実体へ戻す */
export function stripHtml(input: string): string {
  const withoutTags = input.replace(/<[^>]*>/g, " ");
  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** 
 * Markdownの画像、リンク記法を除去・置換します。
 * 複数行にまたがる記法にも対応するため、行分割前のテキスト全体に対して適用することを推奨します。
 */
export function stripMarkdownLinksAndImages(text: string): string {
  let processed = text;
  
  // ネストされた記法（例: [![alt](img)](link)）に対応するため、変化しなくなるまで（最大5回）繰り返す
  for (let i = 0; i < 5; i++) {
    const prev = processed;
    // 画像 ![...](...) または ![...][...] は完全に除去
    processed = processed.replace(/!\[[\s\S]*?\]\s*(?:\([\s\S]*?\)|\[[\s\S]*?\])?/g, "");
    // リンク [...](...) または [...][...] はテキストのみ残す
    processed = processed.replace(/\[([\s\S]*?)\]\s*(?:\([\s\S]*?\)|\[[\s\S]*?\])?/g, "$1");
    if (processed === prev) break;
  }

  // 万が一、不正なパースによって `[(https://...)]` や `(https://...)` のような残骸が残った場合は強制的に除去
  processed = processed.replace(/\[\s*\(\s*https?:\/\/[^\s)\]]+\s*\)\s*\]/g, "");
  processed = processed.replace(/\(\s*https?:\/\/[^\s)\]]+\s*\)/g, "");

  return processed;
}

/** 1行分のMarkdownインライン記法・行頭記号を落としてテキスト化する */
export function stripMarkdownLine(line: string): string {
  let text = line.trim();

  // 見出し(#), 引用(>), 箇条書き(-, *, +), 番号付き(1.) の行頭記号
  text = text.replace(/^#{1,6}\s+/, "");
  text = text.replace(/^>\s?/, "");
  text = text.replace(/^[-*+]\s+/, "");
  text = text.replace(/^\d+\.\s+/, "");


  // 強調(**, __, *, _), 取り消し線(~~), インラインコード(`)
  text = text.replace(/(\*\*|__|~~)(.*?)\1/g, "$2");
  text = text.replace(/(\*|_)(.*?)\1/g, "$2");
  text = text.replace(/`([^`]*)`/g, "$1");

  return text.trim();
}

/** 見出し行・区切り線・箇条書きのみで意味を持たない行かどうか */
export function isStructuralOnly(rawLine: string): boolean {
  const trimmed = rawLine.trim();
  if (trimmed === "") return true;
  // 水平線 (---, ***, ___)
  if (/^([-*_])\1{2,}$/.test(trimmed.replace(/\s/g, ""))) return true;
  // 見出し行は表示対象から省く
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  return false;
}

/**
 * 説明文を一覧カード向けのプレーンテキストへ変換します。
 * 見出し行と箇条書き記号を省き、HTMLを削除したテキスト行のみを連結します。
 * @param description 元の説明文（Markdown/HTMLを含みうる）
 * @returns 表示用のプレーンテキスト
 */
export function toPlainDescription(description: string | null | undefined): string {
  if (!description) return "";

  const noHtml = stripHtml(description);
  // コードフェンス ```...``` はブロックごと除去
  let processed = noHtml.replace(/```[\s\S]*?```/g, "");

  // 画像やリンクの除去・置換（改行またぎに対応するため、行分割前に実行）
  processed = stripMarkdownLinksAndImages(processed);

  const lines = processed.split(/\r?\n/);
  const textLines: string[] = [];
  for (const line of lines) {
    if (isStructuralOnly(line)) continue;
    const text = stripMarkdownLine(line);
    if (text) textLines.push(text);
  }

  return textLines.join(" ").replace(/\s{2,}/g, " ").trim();
}
