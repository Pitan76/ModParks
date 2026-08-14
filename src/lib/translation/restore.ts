/**
 * 訳文の検証と復元。検証に落ちた訳文は決して保存しない（壊れた記法を DB に
 * 残さないため、原文表示へ戻すほうが常に安全）。
 */
import { TOKEN_PATTERN, type MaskedDocument } from "./masking";

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
    if (line?.translatable && sameTokenSequence(line.text, text)) valid.set(index, text);
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

/** 出現順まで含めて一致を求める。順序が変わると表の列がずれるため */
function sameTokenSequence(a: string, b: string): boolean {
  const seqA = tokenSequence(a);
  const seqB = tokenSequence(b);
  if (seqA.length !== seqB.length) return false;
  return seqA.every((v, i) => v === seqB[i]);
}

function tokenSequence(text: string): number[] {
  return [...text.matchAll(tokenRegex())].map((m) => Number(m[1]));
}

/** 置換値に `$` を含みうるため、文字列ではなく関数で差し戻す */
function expandTokens(text: string, tokens: string[]): string {
  return text.replace(tokenRegex(), (_, index: string) => tokens[Number(index)] ?? "");
}
