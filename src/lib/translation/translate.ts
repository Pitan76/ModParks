/**
 * 翻訳の中核。マスク → LLM → 検証 → 復元 の一連を担い、失敗理由を型で返す。
 * DB 保存や権限判定はここでは行わない（呼び出し側の責務）。
 */
import { getMasker, type BodyFormat } from "./masking";
import { parsePayload, payloadLength, toPayload } from "./payload";
import { restore, validateTokens } from "./restore";
import { getTranslationProvider } from "./providers";

/** マスク後の入力上限。超過分は手動翻訳へ誘導する */
export const MAX_INPUT_CHARS = 10_000;

export interface TranslateInput {
  title: string;
  body: string;
  bodyFormat: BodyFormat;
  sourceLocale: string;
  targetLocale: string;
}

export type TranslateResult =
  | { ok: true; title: string; body: string; provider: string; model: string; inputChars: number; outputChars: number }
  | { ok: false; reason: "too_long" | "invalid_output"; provider: string; model: string; inputChars: number; outputChars: number };

/**
 * title と body をまとめて 1 回の呼び出しで訳す。
 * title を先頭行に混ぜることで、本文と語彙が揃い、呼び出し回数も 1 回で済む。
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
  const outputChars = (titleOut.raw?.length ?? 0) + (bodyOut.raw?.length ?? 0);
  if (titleOut.text === null || bodyOut.text === null) {
    return { ok: false, reason: "invalid_output", ...meta, outputChars };
  }
  return { ok: true, title: titleOut.text, body: bodyOut.text, ...meta, outputChars };
}

type DocumentResult = { text: string | null; raw: string | null };
type MaskedDoc = ReturnType<ReturnType<typeof getMasker>["mask"]>;

/**
 * 検証に落ちた場合は 1 度だけ訳し直す。小さいモデルは行番号やトークンを
 * 落とすことがあり、単純な再試行で通ることが多いため。
 * それでも落ちたら text=null を返し、呼び出し側で破棄させる。
 */
async function translateDocument(doc: MaskedDoc, input: TranslateInput): Promise<DocumentResult> {
  const payload = toPayload(doc);
  if (payload.trim() === "") return { text: restore(doc, new Map()), raw: "" };

  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await getTranslationProvider().translate({
      payload,
      sourceLocale: input.sourceLocale,
      targetLocale: input.targetLocale,
      strict: attempt > 0,
    });
    raw += response;
    const parsed = parsePayload(response, doc);
    if (parsed && validateTokens(doc, parsed)) return { text: restore(doc, parsed), raw };
    // 応答の形が原因なので、診断できるよう先頭だけ残す（本文全体はログに出さない）
    console.warn(`translation output rejected (attempt ${attempt + 1}):`, response.slice(0, 300));
  }
  return { text: null, raw };
}
