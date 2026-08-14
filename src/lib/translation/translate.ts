/**
 * 翻訳の中核。マスク → LLM → 検証 → 復元 の一連を担い、失敗理由を型で返す。
 * DB 保存や権限判定はここでは行わない（呼び出し側の責務）。
 */
import { getMasker, type BodyFormat, type MaskedDocument } from "./masking";
import { parsePayload, payloadLength, toPayloadChunks, translatableIndices } from "./payload";
import { keepValidLines, restore } from "./restore";
import { getTranslationProvider } from "./providers";

/** マスク後の入力上限。超過分は手動翻訳へ誘導する */
export const MAX_INPUT_CHARS = 10_000;

/**
 * 訳せた行の割合がこれを下回ったら失敗とみなす。
 * 数行だけ訳された中途半端な状態を「翻訳済み」として保存しないための下限。
 */
const MIN_COVERAGE = 0.7;

export interface TranslateInput {
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  sourceLocale: string;
  targetLocale: string;
}

interface ResultMeta {
  provider: string;
  model: string;
  inputChars: number;
  outputChars: number;
}

export type TranslateResult =
  | ({ ok: true; title: string; body: string } & ResultMeta)
  | ({ ok: false; reason: "too_long" | "invalid_output" } & ResultMeta);

/**
 * title と body をまとめて訳す。
 * 本文は塊に分けて渡す（一度に投げると応答が出力上限で切れるため）。
 */
export async function translateContent(input: TranslateInput): Promise<TranslateResult> {
  const provider = getTranslationProvider();
  const titleDoc = getMasker("plaintext").mask(input.title);
  const bodyDoc  = getMasker(input.bodyFormat).mask(input.body);
  const inputChars = payloadLength(titleDoc) + payloadLength(bodyDoc);
  const meta = { provider: provider.name, model: provider.model, inputChars };

  if (inputChars > MAX_INPUT_CHARS) return { ok: false, reason: "too_long", ...meta, outputChars: 0 };

  const [titleOut, bodyOut] = await Promise.all([
    translateDocument(titleDoc, input),
    translateDocument(bodyDoc, input),
  ]);
  const outputChars = titleOut.outputChars + bodyOut.outputChars;
  if (titleOut.text === null || bodyOut.text === null) {
    return { ok: false, reason: "invalid_output", ...meta, outputChars };
  }
  return { ok: true, title: titleOut.text, body: bodyOut.text, ...meta, outputChars };
}

interface DocumentResult {
  /** 訳出できた本文。訳せた割合が下限を下回った場合は null */
  text: string | null;
  outputChars: number;
}

/**
 * 文書を塊ごとに訳し、トークンが保たれた行だけを採用する。
 * 崩れた行は原文のまま残るので、一部が訳せなくても全体は失われない。
 */
async function translateDocument(doc: MaskedDocument, input: TranslateInput): Promise<DocumentResult> {
  const chunks = toPayloadChunks(doc);
  if (chunks.length === 0) return { text: restore(doc, new Map()), outputChars: 0 };

  const translated = new Map<number, string>();
  let outputChars = 0;
  for (const chunk of chunks) {
    const result = await translateChunk(chunk.text, chunk.indices, doc, input);
    outputChars += result.outputChars;
    for (const [index, text] of result.lines) translated.set(index, text);
  }

  const total = translatableIndices(doc).length;
  if (translated.size / total < MIN_COVERAGE) return { text: null, outputChars };
  return { text: restore(doc, translated), outputChars };
}

/** 採用できた行が 1 行も無ければ、書式の指示を強めて 1 度だけ訳し直す */
async function translateChunk(
  payload: string,
  indices: number[],
  doc: MaskedDocument,
  input: TranslateInput,
): Promise<{ lines: Map<number, string>; outputChars: number }> {
  let outputChars = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await getTranslationProvider().translate({
      payload,
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      strict: attempt > 0,
    });
    outputChars += raw.length;
    const lines = keepValidLines(doc, parsePayload(raw, indices));
    if (lines.size > 0) return { lines, outputChars };
    // 応答の形が原因なので、診断できるよう先頭だけ残す（本文全体はログに出さない）
    console.warn(`translation chunk rejected (attempt ${attempt + 1}):`, raw.slice(0, 300));
  }
  return { lines: new Map(), outputChars };
}
