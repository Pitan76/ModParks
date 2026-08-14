/**
 * マスク済み文書と LLM のやり取りに使う表現。行番号を付けて渡し、同じ行番号で
 * 返させることで、行の増減や順序の入れ替わりを検出できるようにする。
 *
 * 長い本文を一度に投げると小さいモデルは途中で書式を崩すため、塊に分けて渡す。
 */
import type { MaskedDocument } from "./masking";

const LINE_PREFIX = "L";
/** 行頭の飾り（箇条書き・強調）と、全角コロンや空白の揺れを許容する */
const RESPONSE_LINE = /^\s*(?:[-*]\s*)?\*{0,2}L\s*(\d+)\*{0,2}\s*[:：]\s?([\s\S]*)$/;

/**
 * 1 回の呼び出しに載せる最大文字数。
 * 小さいほど書式は安定し、1 回あたりの生成量（＝消費ニューロン）も抑えられるが、
 * 呼び出し回数は増える。出力の上限トークンとセットで決めること。
 */
const CHUNK_CHARS = 800;

export interface PayloadChunk {
  /** この塊に含まれる行番号 */
  indices: number[];
  text: string;
}

/** LLM に渡す本文。翻訳対象の行だけを行番号付きで並べる */
export function toPayload(doc: MaskedDocument): string {
  return numberedLines(doc).map(({ text }) => text).join("\n");
}

/** マスク後の総文字数。入力上限の判定はこの値で行う */
export const payloadLength = (doc: MaskedDocument): number => toPayload(doc).length;

/** 塊に分けたペイロード。1 行が上限を超える場合はその行だけで 1 塊にする */
export function toPayloadChunks(doc: MaskedDocument): PayloadChunk[] {
  const chunks: PayloadChunk[] = [];
  let current: PayloadChunk = { indices: [], text: "" };

  for (const { index, text } of numberedLines(doc)) {
    const wouldExceed = current.text.length + text.length > CHUNK_CHARS;
    if (wouldExceed && current.indices.length > 0) {
      chunks.push(current);
      current = { indices: [], text: "" };
    }
    current.indices.push(index);
    current.text = current.text === "" ? text : `${current.text}\n${text}`;
  }
  if (current.indices.length > 0) chunks.push(current);
  return chunks;
}

/**
 * LLM の応答を行番号ごとの訳文に戻す。
 *
 * 欠けた行や余分な行はここでは弾かず、拾えたものだけを返す。
 * 行単位で原文へフォールバックできるため、1 行の崩れで全体を捨てる必要はない。
 */
export function parsePayload(raw: string, expected: readonly number[]): Map<number, string> {
  const allowed = new Set(expected);
  const parsed = new Map<number, string>();
  for (const line of raw.split("\n")) {
    const m = RESPONSE_LINE.exec(line);
    if (!m) continue; // 前置きなどの余分な行は捨てる
    const index = Number(m[1]);
    if (allowed.has(index)) parsed.set(index, m[2]);
  }
  return parsed;
}

/** 翻訳対象の行番号 */
export const translatableIndices = (doc: MaskedDocument): number[] =>
  numberedLines(doc).map(({ index }) => index);

const numberedLines = (doc: MaskedDocument): { index: number; text: string }[] =>
  doc.lines.flatMap((line, index) =>
    line.translatable ? [{ index, text: `${LINE_PREFIX}${index}: ${line.text}` }] : []);
