/**
 * 翻訳の中核。マスク → LLM → 検証 → 復元 の一連を担い、失敗理由を型で返す。
 * DB 保存や権限判定はここでは行わない（呼び出し側の責務）。
 */
import { getMasker, type BodyFormat, type MaskedDocument } from "./masking";
import { parsePayload, payloadLength, toPayloadChunks, toPayloadFor, translatableIndices } from "./payload";
import { keepValidLines, restore } from "./restore";
import { getTranslationProvider } from "./providers";
import type { TranslationSettings } from "./settings";

/**
 * 訳せた行の割合がこれを下回ったら失敗とみなす。
 * 数行だけ訳された中途半端な状態を「翻訳済み」として保存しないための下限。
 */
const MIN_COVERAGE = 0.7;

/** 1 つの塊に対する呼び出し回数の上限。欠けた行だけを詰め直して繰り返す */
const MAX_ATTEMPTS = 3;

export interface TranslateInput {
  body: string;
  bodyFormat: BodyFormat;
  sourceLocale: string;
  targetLocale: string;
  /** 実行パラメータ。管理画面から変更できる */
  settings: TranslationSettings;
}

interface ResultMeta {
  provider: string;
  model: string;
  inputChars: number;
  outputChars: number;
}

export type TranslateResult =
  | ({ ok: true; body: string } & ResultMeta)
  | ({ ok: false; reason: "too_long" | "invalid_output" } & ResultMeta);

/**
 * 説明本文を訳す。
 *
 * タイトルは訳さない。Mod 名は固有名詞であり、訳すとかえって通じなくなるため
 * （"Ambient Camera" を訳して探せなくなる方が損失が大きい）。
 * 本文は塊に分けて渡す（一度に投げると応答が出力上限で切れるため）。
 */
export async function translateContent(input: TranslateInput): Promise<TranslateResult> {
  const provider = getTranslationProvider();
  const { settings } = input;
  const bodyDoc = getMasker(input.bodyFormat).mask(input.body);
  const inputChars = payloadLength(bodyDoc);
  const meta = { provider: provider.name, model: settings.model, inputChars };

  if (inputChars > settings.maxInputChars) {
    return { ok: false, reason: "too_long", ...meta, outputChars: 0 };
  }

  const bodyOut = await translateDocument(bodyDoc, input);
  const outputChars = bodyOut.outputChars;
  if (bodyOut.text === null) return { ok: false, reason: "invalid_output", ...meta, outputChars };
  return { ok: true, body: bodyOut.text, ...meta, outputChars };
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
  const chunks = toPayloadChunks(doc, input.settings.chunkChars);
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

/**
 * 塊を訳す。応答から採用できなかった行は、その行だけを詰め直して訳し直す。
 *
 * 応答の打ち切りや 1 行の崩れで欠けた行を、原文のまま残さないため。
 * 再要求は残った行だけなので、丸ごと訳し直すより短く済む。
 */
async function translateChunk(
  payload: string,
  indices: number[],
  doc: MaskedDocument,
  input: TranslateInput,
): Promise<{ lines: Map<number, string>; outputChars: number }> {
  const lines = new Map<number, string>();
  let outputChars = 0;
  let pending = payload;
  let pendingIndices = indices;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await getTranslationProvider().translate({
      payload:      pending,
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      strict:       attempt > 0,
      model:        input.settings.model,
      maxTokens:    input.settings.maxTokens,
    });
    outputChars += raw.length;
    for (const [index, text] of keepValidLines(doc, parsePayload(raw, pendingIndices))) {
      lines.set(index, text);
    }

    pendingIndices = pendingIndices.filter((i) => !lines.has(i));
    if (pendingIndices.length === 0) return { lines, outputChars };
    // 応答の形が原因なので、診断できるよう先頭だけ残す（本文全体はログに出さない）
    console.warn(
      `translation incomplete (attempt ${attempt + 1}, ${pendingIndices.length} lines left):`,
      raw.slice(0, 200),
    );
    pending = toPayloadFor(doc, pendingIndices);
  }
  return { lines, outputChars };
}
