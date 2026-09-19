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

/**
 * コードブロック内の主要な行コメント。
 * 様々な言語に対応するため、コメント記号を拡張。
 */
const CODE_COMMENT = /^(\s*(?:\/\/|#|--|;|'|%)\s*)(.+)$/;

interface MultiCommentPair {
  start: string;
  end: string;
  startPattern: RegExp;
}

/**
 * 主要な言語における複数行コメントの開始と終了ペア。
 */
const MULTI_COMMENT_PAIRS: MultiCommentPair[] = [
  { start: "/*", end: "*/", startPattern: /^\s*\/\*/ },
  { start: "<!--", end: "-->", startPattern: /^\s*<!--/ },
  { start: '"""', end: '"""', startPattern: /^\s*"""/ },
  { start: "'''", end: "'''", startPattern: /^\s*'''/ },
  { start: "{-", end: "-}", startPattern: /^\s*\{-/ },
  { start: "(*", end: "*)", startPattern: /^\s*\(\*/ },
  { start: "--[[", end: "]]", startPattern: /^\s*--\[\[/ },
];

export const markdownMasker: FormatMasker = {
  mask(text: string): MaskedDocument {
    const bag = new TokenBag();
    let inFence = false;
    let activeEndToken: string | null = null;
    const lines = text.split("\n").map((raw): MaskedLine => {
      if (FENCE.test(raw)) {
        inFence = !inFence;
        activeEndToken = null;
        return verbatim(raw);
      }
      if (inFence) {
        const result = maskCodeLine(raw, activeEndToken, bag);
        activeEndToken = result.nextEndToken;
        return result.line;
      }
      return maskLine(raw, bag);
    });
    return { lines, tokens: bag.toArray() };
  },
};

interface CodeLineResult {
  line: MaskedLine;
  nextEndToken: string | null;
}

/**
 * コードブロック内の複数行コメントまたは単一行コメントを抽出し、
 * マスク処理を行う。
 */
function maskCodeLine(raw: string, activeEndToken: string | null, bag: TokenBag): CodeLineResult {
  if (activeEndToken !== null) {
    return handleInMultiComment(raw, activeEndToken, bag);
  }
  const multiStart = findMultiCommentStart(raw, bag);
  if (multiStart) return multiStart;

  return handleSingleLineComment(raw, bag);
}

/**
 * 複数行コメントの内部にある行の処理。
 */
function handleInMultiComment(raw: string, activeEndToken: string | null, bag: TokenBag): CodeLineResult {
  if (!activeEndToken) return { line: verbatim(raw), nextEndToken: null };
  const endIdx = raw.indexOf(activeEndToken);
  if (endIdx === -1) {
    const leadingSpace = /^\s*/.exec(raw)?.[0] ?? "";
    const body = raw.slice(leadingSpace.length);
    if (body.trim() === "") {
      return { line: verbatim(raw), nextEndToken: activeEndToken };
    }
    return {
      line: { marker: leadingSpace, text: maskInline(body, INLINE_PATTERNS, bag), translatable: true },
      nextEndToken: activeEndToken,
    };
  }

  const commentBody = raw.slice(0, endIdx);
  const after = raw.slice(endIdx);
  const tokenStr = bag.add(after);
  return {
    line: {
      marker: "",
      text: maskInline(commentBody, INLINE_PATTERNS, bag) + tokenStr,
      translatable: true,
    },
    nextEndToken: null,
  };
}

/**
 * 複数行コメントの開始を探し、見つかれば処理する。
 */
function findMultiCommentStart(raw: string, bag: TokenBag): CodeLineResult | null {
  for (const pair of MULTI_COMMENT_PAIRS) {
    const startM = pair.startPattern.exec(raw);
    if (!startM) continue;

    const marker = startM[0];
    const commentContent = raw.slice(marker.length);
    const endIdx = commentContent.indexOf(pair.end);

    if (endIdx !== -1) {
      const commentBody = commentContent.slice(0, endIdx);
      const after = commentContent.slice(endIdx);
      const tokenStr = bag.add(after);
      return {
        line: {
          marker,
          text: maskInline(commentBody, INLINE_PATTERNS, bag) + tokenStr,
          translatable: true,
        },
        nextEndToken: null,
      };
    }

    return {
      line: {
        marker,
        text: maskInline(commentContent, INLINE_PATTERNS, bag),
        translatable: true,
      },
      nextEndToken: pair.end,
    };
  }
  return null;
}

/**
 * 単一行コメントの処理。
 */
function handleSingleLineComment(raw: string, bag: TokenBag): CodeLineResult {
  const comment = CODE_COMMENT.exec(raw);
  if (!comment) return { line: verbatim(raw), nextEndToken: null };
  return {
    line: {
      marker: comment[1],
      text: maskInline(comment[2], INLINE_PATTERNS, bag),
      translatable: true,
    },
    nextEndToken: null,
  };
}

const verbatim = (raw: string): MaskedLine => ({ marker: raw, text: "", translatable: false });

function maskLine(raw: string, bag: TokenBag): MaskedLine {
  const marker = LINE_MARKER.exec(raw)?.[0] ?? "";
  const body = raw.slice(marker.length);
  if (body.trim() === "") return verbatim(raw);
  return { marker, text: maskInline(body, INLINE_PATTERNS, bag), translatable: true };
}
