/**
 * 訳文の検証と復元。検証に落ちた訳文は決して保存しない（壊れた記法を DB に
 * 残さないため、原文表示へ戻すほうが常に安全）。
 */
import { TOKEN_PATTERN, type MaskedDocument, type MaskedToken } from "./masking";

/** 状態を持つ g フラグ付き正規表現を使い回さないよう、都度作る */
const tokenRegex = (): RegExp => new RegExp(TOKEN_PATTERN.source, "g");

/**
 * トークンが保たれている行だけを残す。
 *
 * 全体を一括で合否判定すると、1 行の崩れや応答の途中打ち切りで訳文をすべて
 * 失う。行単位で落とせば、その行だけ原文のまま残して他は訳文にできる。
 * 表のセル区切りもトークンなので、これがセル数の一致検証を兼ねる。
 */
export function keepValidLines(doc: MaskedDocument, translated: Map<number, string>): Map<number, string> {
  const valid = new Map<number, string>();
  for (const [index, text] of translated) {
    const line = doc.lines[index];
    if (line?.translatable && sameTokenSequence(line.text, text, doc.tokens)) valid.set(index, text);
  }
  return valid;
}

/** 訳文を原文の構造へ戻す。検証を通した Map のみを渡すこと */
export function restore(doc: MaskedDocument, translated: Map<number, string>): string {
  return doc.lines
    .map((line, i) => {
      if (!line.translatable) return line.marker;
      return line.marker + expandTokens(translated.get(i) ?? line.text, doc.tokens);
    })
    .join("\n");
}

/**
 * トークンの過不足が無いことを検証する。
 *
 * 行内記法は順序を問わない。翻訳では語順が変わるのが普通で
 * （「`A` に `B` を作る」→「Create `B` in `A`」）、順序まで求めると
 * 正しい訳が弾かれてしまうため。
 * 表のセル区切りのように位置が意味を持つものだけ、並び順も一致を求める。
 */
function sameTokenSequence(a: string, b: string, tokens: MaskedToken[]): boolean {
  const seqA = tokenSequence(a);
  const seqB = tokenSequence(b);
  if (!sameMultiset(seqA, seqB)) return false;

  const isOrdered = (id: number) => tokens[id]?.ordered === true;
  const orderedA = seqA.filter(isOrdered);
  const orderedB = seqB.filter(isOrdered);
  return orderedA.every((v, i) => v === orderedB[i]);
}

function sameMultiset(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<number, number>();
  for (const v of a) counts.set(v, (counts.get(v) ?? 0) + 1);
  for (const v of b) {
    const left = counts.get(v);
    if (!left) return false;
    counts.set(v, left - 1);
  }
  return true;
}

function tokenSequence(text: string): number[] {
  return [...text.matchAll(tokenRegex())].map((m) => Number(m[1]));
}

/** 置換値に `$` を含みうるため、文字列ではなく関数で差し戻す */
function expandTokens(text: string, tokens: MaskedToken[]): string {
  return text.replace(tokenRegex(), (_, index: string) => tokens[Number(index)]?.text ?? "");
}
