/**
 * PukiWiki 用マスカ。行頭記法・プラグイン・表のセル区切りをすべてトークン化し、
 * LLM には素の文言だけを渡す。記法が壊れると描画が破綻するため、他書式より
 * マスクの範囲を広く取る。
 */
import { TokenBag, type FormatMasker, type MaskedDocument, type MaskedLine } from "./types";
import { maskInline, opaque, HTML_TAG_PATTERN, URL_PATTERN, type InlinePattern } from "./inline";

/** 見出し `*` / リスト `-` `+` / 引用 `>` / 定義 `:` / 整形済み行頭の空白 */
const LINE_MARKER = /^(\s*(?:\*{1,3}|-{1,3}|\+{1,3}|>{1,3}|:)?\s*)/;

/** ブロックプラグインと行コメント。中身に触れず丸ごと残す */
const VERBATIM_LINE = /^\s*(?:#[a-zA-Z][\w]*(?:\(|$)|\/\/)/;

const INLINE_PATTERNS: InlinePattern[] = [
  // 表のセル区切り。トークン化することで訳文でもセル数が保たれる
  opaque(/\|/),
  opaque(/&[a-zA-Z][\w]*(?:\([^)]*\))?(?:\{[^}]*\})?;?/),
  opaque(/#[a-zA-Z][\w]*\([^)]*\)/),
  {
    pattern: /\[\[([^\]>:]*)(?:>|:)([^\]]+)\]\]/,
    keep: (m) => ({ before: "[[", visible: m[1], after: `>${m[2]}]]` }),
  },
  opaque(/\[\[[^\]]*\]\]/),
  opaque(/'{2,3}/),
  opaque(/%{2}/),
  opaque(HTML_TAG_PATTERN),
  opaque(URL_PATTERN),
  // 行末の `~` は改行指定。文中の波ダッシュと区別するため末尾のみ対象にする
  opaque(/~$/),
];

export const pukiwikiMasker: FormatMasker = {
  mask(text: string): MaskedDocument {
    const bag = new TokenBag();
    const lines = text.split("\n").map((raw): MaskedLine => maskLine(raw, bag));
    return { lines, tokens: bag.toArray() };
  },
};

const verbatim = (raw: string): MaskedLine => ({ marker: raw, text: "", translatable: false });

function maskLine(raw: string, bag: TokenBag): MaskedLine {
  if (VERBATIM_LINE.test(raw)) return verbatim(raw);
  const marker = LINE_MARKER.exec(raw)?.[0] ?? "";
  const body = raw.slice(marker.length);
  if (body.trim() === "") return verbatim(raw);
  return { marker, text: maskInline(body, INLINE_PATTERNS, bag), translatable: true };
}
