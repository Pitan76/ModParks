import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { requestCommentTranslation } from "@/lib/translation/commentService";
import { TRANSLATION_ERROR_STATUS } from "@/lib/translation/errorStatus";

const requestSchema = z.object({
  commentId: z.string().min(1),
  locale: z.string().min(2).max(10),
});

/**
 * コメントの閲覧者主導 AI 翻訳。既訳があれば LLM を経由せずに返す。
 * ログイン必須にしているのは、匿名の連打で LLM の課金が伸びるのを防ぐため（/api/translate と同じ）。
 */
export async function POST(req: NextRequest) {
  try {
    const { db, userId } = await getAuthenticatedDb();
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

    const result = await requestCommentTranslation(db, parsed.data.commentId, parsed.data.locale, userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: TRANSLATION_ERROR_STATUS[result.error] });

    return NextResponse.json({ body: result.body, bodyFormat: result.bodyFormat, cached: result.cached });
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    throw e;
  }
}
