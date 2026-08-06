import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/config/readSettings";
import { eq, and } from "drizzle-orm";
import type { ApiProject, PaginatedResponse } from "@/types/api-v1";
import { createId } from "@paralleldrive/cuid2";
import { withPublicCache } from "@/lib/http/cache";
import { posts, projects, userProfiles } from "@/db/schema";
import { CONTENT_TYPES, type ContentType } from "@/lib/data/projectTypes";
import { listProjectPosts, type ProjectListSort } from "@/lib/queries/postList";
import { toApiProjectV1 } from "@/lib/api/toApiV1";

/**
 * v1 互換シム。
 *
 * v1 のフィールド名（name/description/status）は廃止したドメインの用語なので、
 * 内部では使わず、この境界だけで posts/projects から詰め替える。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
/** v1 の sort パラメータを共有クエリの並び順へ写す。既定は downloads（v1 の従来挙動） */
function toListSort(raw: string | null): ProjectListSort {
  if (raw === "updated") return "updated";
  if (raw === "newest") return "newest";
  return "downloads";
}

export async function GET(request: Request) {
  const db = await getDatabase();

  const { searchParams } = new URL(request.url);

  const limitParam = parseInt(searchParams.get("limit") || "");
  const appSettings = await getAppSettings();
  const limit = isNaN(limitParam) ? appSettings.apiDefaultLimit : Math.min(limitParam, appSettings.apiMaxLimit);
  const offsetParam = parseInt(searchParams.get("offset") || "0");
  const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

  const type = searchParams.get("type");
  const q = searchParams.get("q");
  const author = searchParams.get("author");

  let authorId: string | undefined;
  // 自分自身の一覧を見るときだけ非公開を含める。他人の author= 指定では常に公開分のみ
  let includeHidden = false;
  if (author) {
    const authorProfile = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(eq(userProfiles.username, author))
      .get();
    if (!authorProfile) {
      const empty: PaginatedResponse<ApiProject> = { data: [], meta: { limit, offset, count: 0 } };
      return withPublicCache(NextResponse.json(empty));
    }
    authorId = authorProfile.userId;

    const auth = await validateApiKey(request);
    includeHidden = !!auth.valid && auth.userId === authorId;
  }

  const rows = await listProjectPosts(db, {
    authorId,
    includeHidden,
    // v1 は author= を伴わない一覧で自分の下書きを返さない契約
    publicOnly: true,
    type: type && (CONTENT_TYPES as readonly string[]).includes(type) ? (type as ContentType) : undefined,
    q: q ?? undefined,
    sort: toListSort(searchParams.get("sort")),
    limit,
    offset,
  });

  const data = rows.map(toApiProjectV1);
  const response: PaginatedResponse<ApiProject> = { data, meta: { limit, offset, count: data.length } };
  return withPublicCache(NextResponse.json(response));
}

export async function POST(request: Request) {
  const db = await getDatabase();

  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, slug, description, type } = body;

  if (!name || !slug || !type) {
    return NextResponse.json({ error: "name, slug, and type are required" }, { status: 400 });
  }

  const existing = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.kind, "project"), eq(posts.slug, slug))).get();
  if (existing) {
    return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
  }

  const id = createId();

  // posts と projects は必ず同時に作る（DESIGN.md 12章）。D1 は transaction() 非対応のため batch を使う。
  await db.batch([
    db.insert(posts).values({
      id,
      authorId: auth.userId,
      kind: "project",
      slug,
      title: name,
      body: description || "",
      bodyFormat: "markdown",
      visibility: "draft",
    }),
    db.insert(projects).values({
      id,
      type,
      license: "All Rights Reserved",
    }),
  ]);

  return NextResponse.json({ success: true, data: { id, slug, name, type } });
}
