import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { requestTranslation, type TranslationError } from "@/lib/translation/service";

const requestSchema = z.object({
  postId: z.string().min(1),
  locale: z.string().min(2).max(10),
});

/** エラー種別ごとの HTTP ステータス。文言はクライアント側で翻訳する */
const STATUS: Record<TranslationError, number> = {
  invalid_locale: 400,
  not_found:      404,
  not_public:     403,
  rate_limited:   429,
  too_long:       413,
  cooling_down:   429,
  invalid_output: 502,
  provider_error: 502,
  budget_exceeded: 429,
  translation_disabled: 403,
};

/**
 * 閲覧者主導の AI 翻訳。既訳があれば LLM を経由せずに返す。
 * ログイン必須にしているのは、匿名の連打で LLM の課金が伸びるのを防ぐため。
 */
export async function POST(req: NextRequest) {
  try {
    const { db, userId } = await getAuthenticatedDb();
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    const result = await requestTranslation(db, parsed.data.postId, parsed.data.locale, userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });

    return NextResponse.json({
      title:      result.title,
      body:       result.body,
      bodyFormat: result.bodyFormat,
      cached:     result.cached,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
