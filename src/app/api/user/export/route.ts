import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";
import { users, userProfiles, userSettings, collections, comments } from "@/db/schema";
import { listProjectPosts, listIdeaPosts } from "@/lib/queries/postList";
import { getTranslations } from "next-intl/server";
import type { AppLocale } from "@/lib/i18n/routing";
import { buildCsv, buildTextReport, type ExportData } from "./exportFormats";

export async function GET(req: NextRequest) {
  try {
    const { db, session } = await getAuthenticatedDb();
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json"; // json, csv, md, txt

    // Fetch user data
    const user = await db.select().from(users).where(eq(users.id, userId)).get();
    const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();

    // Fetch related content
    // 本人のデータなので非公開・下書きも含めて全件取得する
    const userProjects = await listProjectPosts(db, { authorId: userId, includeHidden: true, limit: 10000 });
    const userIdeas = await listIdeaPosts(db, { authorId: userId, includeHidden: true, limit: 10000 });
    const userCollections = await db.select().from(collections).where(eq(collections.userId, userId)).all();
    const userComments = await db.select({ id: comments.id }).from(comments).where(eq(comments.authorId, userId)).all();

    const data = {
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        createdAt: user?.createdAt,
      },
      profile,
      settings,
      stats: {
        projectsCount: userProjects.length,
        ideasCount: userIdeas.length,
        collectionsCount: userCollections.length,
        commentsCount: userComments.length,
      },
      projects: userProjects.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.title,
        description: p.body,
        type: p.type,
        status: p.visibility,
        downloads: p.downloads,
        totalDownloads: p.totalDownloads,
        externalDownloads: p.externalDownloads,
        createdAt: p.createdAt,
      })),
      ideas: userIdeas.map(i => ({
        id: i.id,
        title: i.title,
        status: i.status,
        createdAt: i.createdAt,
      })),
      collections: userCollections.map(c => ({
        id: c.id,
        name: c.name,
        visibility: c.visibility,
        createdAt: c.createdAt,
      })),
    };

    if (format === "json") {
      return NextResponse.json(data, {
        headers: {
          "Content-Disposition": `attachment; filename="modparks_data_${userId}.json"`,
        },
      });
    }

    // 文言は閲覧中の画面ではなく、本人の言語設定に合わせる
    const locale = (settings?.locale ?? "ja") as AppLocale;
    const t = await getTranslations({ locale, namespace: "Export" });

    if (format === "csv") {
      const csvContent = buildCsv(data as ExportData, t);

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="modparks_profile_${userId}.csv"`,
        },
      });
    }

    if (format === "md" || format === "txt") {
      const isMd = format === "md";
      const content = buildTextReport(data as ExportData, t, locale, isMd);

      return new NextResponse(content, {
        headers: {
          "Content-Type": isMd ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="modparks_data_${userId}.${isMd ? "md" : "txt"}"`,
        },
      });
    }

    return NextResponse.json({ error: "Invalid format" }, { status: 400 });

  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("API /user/export Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
