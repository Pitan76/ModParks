/**
 * マスク済み文書と LLM のやり取りに使う表現。行番号を付けて渡し、同じ行番号で
 * 返させることで、行の増減や順序の入れ替わりを検出できるようにする。
 */
import type { MaskedDocument } from "./masking";

const LINE_PREFIX = "L";
const RESPONSE_LINE = /^\s*L(\d+):\s?([\s\S]*)$/;

/** LLM に渡す本文。翻訳対象の行だけを行番号付きで並べる */
export function toPayload(doc: MaskedDocument): string {
  return doc.lines
    .map((line, i) => (line.translatable ? `${LINE_PREFIX}${i}: ${line.text}` : null))
    .filter((v): v is string => v !== null)
    .join("\n");
}

/** ペイロードの文字数。入力上限の判定はマスク後のこの値で行う */
export const payloadLength = (doc: MaskedDocument): number => toPayload(doc).length;

/**
 * LLM の応答を行番号ごとの訳文に戻す。
 * 期待する行番号が過不足なく揃っていない場合は null を返し、呼び出し側で破棄させる。
 */
export function parsePayload(raw: string, doc: MaskedDocument): Map<number, string> | null {
  const expected = expectedIndices(doc);
  const parsed = new Map<number, string>();
  for (const line of raw.split("\n")) {
    const m = RESPONSE_LINE.exec(line);
    if (!m) continue; // 前置きなどの余分な行は捨てる
    parsed.set(Number(m[1]), m[2]);
  }
  if (parsed.size !== expected.size) return null;
  if (![...expected].every((i) => parsed.has(i))) return null;
  return parsed;
}

const expectedIndices = (doc: MaskedDocument): Set<number> =>
  new Set(doc.lines.flatMap((line, i) => (line.translatable ? [i] : [])));
