/**
 * 行内記法のマスキング。書式ごとのパターンを与えると、該当箇所をトークンに
 * 置き換えたテキストを返す。
 */
import { TOKEN_PATTERN, type TokenBag } from "./types";

/**
 * マスク対象パターン。`keep` を与えた場合、その捕捉グループだけを翻訳対象として
 * 残し、前後をトークン化する（例: `[[表示名>URL]]` の表示名）。
 */
export interface InlinePattern {
  pattern: RegExp;
  /** 行内での位置が意味を持つか（表のセル区切りなど） */
  ordered?: boolean;
  /** 表示テキストを残す場合の、前後を組み立てる関数 */
  keep?: (match: RegExpExecArray) => { before: string; visible: string; after: string };
}

/** マッチ全体をトークン化する単純パターン */
export const opaque = (pattern: RegExp): InlinePattern => ({ pattern });

/** 位置が意味を持つ記号。訳文でも同じ順序で並んでいることを要求する */
export const orderedOpaque = (pattern: RegExp): InlinePattern => ({ pattern, ordered: true });

/**
 * 与えられたパターン群で行内をマスクする。
 * パターンは配列の順に適用されるため、包含関係のあるものは広い方を先に置く。
 */
export function maskInline(text: string, patterns: InlinePattern[], bag: TokenBag): string {
  return patterns.reduce((acc, p) => applyPattern(acc, p, bag), text);
}

function applyPattern(text: string, { pattern, keep, ordered }: InlinePattern, bag: TokenBag): string {
  const re = new RegExp(pattern.source, ensureGlobal(pattern.flags));
  let result = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // 置換済みのトークンを後続パターン（HTML タグなど）が二重にマスクしないよう素通しする
    const replaced = isTokenRef(m[0]) ? m[0] : replaceMatch(m, keep, bag, ordered === true);
    result += text.slice(last, m.index) + replaced;
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // 空マッチでの無限ループを防ぐ
  }
  return result + text.slice(last);
}

function replaceMatch(
  m: RegExpExecArray,
  keep: InlinePattern["keep"],
  bag: TokenBag,
  ordered: boolean,
): string {
  if (!keep) return bag.add(m[0], ordered);
  const { before, visible, after } = keep(m);
  return bag.add(before, ordered) + visible + bag.add(after, ordered);
}

const isTokenRef = (text: string): boolean =>
  new RegExp(`^${TOKEN_PATTERN.source}$`).test(text);

const ensureGlobal = (flags: string): string => (flags.includes("g") ? flags : `${flags}g`);

/** 素の URL。どの書式でも翻訳されては困る */
export const URL_PATTERN = /https?:\/\/[^\s)>\]|]+/;

/** HTML タグ。本文に混ざりうるため常にマスクする */
export const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^<>]*>/;
