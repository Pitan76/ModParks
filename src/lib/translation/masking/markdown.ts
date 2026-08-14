/**
 * Markdown 用マスカ。見出し・箇条書き・引用の行頭記法を剥がし、コードブロックは
 * 翻訳対象から除外する。
 */
import { TokenBag, type FormatMasker, type MaskedDocument, type MaskedLine } from "./types";
import { maskInline, opaque, HTML_TAG_PATTERN, URL_PATTERN, type InlinePattern } from "./inline";

/** 行頭の見出し・箇条書き・引用・チェックボックス */
const LINE_MARKER = /^(\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)?)/;

const FENCE = /^\s*(?:```|~~~)/;

const INLINE_PATTERNS: InlinePattern[] = [
  opaque(/`[^`]*`/),
  // 画像は代替テキストも訳す価値が薄く、URL 混入の危険が高いので丸ごとマスクする
  opaque(/!\[[^\]]*\]\([^)]*\)/),
  {
    pattern: /\[([^\]]*)\]\(([^)]*)\)/,
    keep: (m) => ({ before: "[", visible: m[1], after: `](${m[2]})` }),
  },
  opaque(HTML_TAG_PATTERN),
  opaque(URL_PATTERN),
];

export const markdownMasker: FormatMasker = {
  mask(text: string): MaskedDocument {
    const bag = new TokenBag();
    let inFence = false;
    const lines = text.split("\n").map((raw): MaskedLine => {
      if (FENCE.test(raw)) {
        inFence = !inFence;
        return verbatim(raw);
      }
      if (inFence) return verbatim(raw);
      return maskLine(raw, bag);
    });
    return { lines, tokens: bag.toArray() };
  },
};

const verbatim = (raw: string): MaskedLine => ({ marker: raw, text: "", translatable: false });

function maskLine(raw: string, bag: TokenBag): MaskedLine {
  const marker = LINE_MARKER.exec(raw)?.[0] ?? "";
  const body = raw.slice(marker.length);
  if (body.trim() === "") return verbatim(raw);
  return { marker, text: maskInline(body, INLINE_PATTERNS, bag), translatable: true };
}
