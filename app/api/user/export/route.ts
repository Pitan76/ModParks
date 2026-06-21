import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";
import { users, userProfiles, userSettings, projects, ideas, collections, ideaComments, projectComments } from "@/db/schema";

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
    const userProjects = await db.select().from(projects).where(eq(projects.authorId, userId)).all();
    const userIdeas = await db.select().from(ideas).where(eq(ideas.authorId, userId)).all();
    const userCollections = await db.select().from(collections).where(eq(collections.userId, userId)).all();
    const userIdeaComments = await db.select().from(ideaComments).where(eq(ideaComments.authorId, userId)).all();
    const userProjectComments = await db.select().from(projectComments).where(eq(projectComments.authorId, userId)).all();

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
        commentsCount: userIdeaComments.length + userProjectComments.length,
      },
      projects: userProjects.map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        type: p.type,
        status: p.status,
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

    if (format === "csv") {
      // Create a simplified CSV for the user profile and stats
      const header = ["ユーザーID", "ユーザー名", "表示名", "メールアドレス", "作成日", "プロジェクト数", "アイデア数", "リスト数", "コメント数"];
      const row = [
        data.user.id || "",
        data.profile?.username || "",
        data.profile?.displayName || "",
        data.user.email || "",
        data.user.createdAt ? new Date(data.user.createdAt).toISOString() : "",
        data.stats.projectsCount.toString(),
        data.stats.ideasCount.toString(),
        data.stats.collectionsCount.toString(),
        data.stats.commentsCount.toString(),
      ];

      const csvContent = [header.join(","), row.map(r => `"${String(r).replace(/"/g, '""')}"`).join(",")].join("\n");
      
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="modparks_profile_${userId}.csv"`,
        },
      });
    }

    if (format === "md" || format === "txt") {
      const isMd = format === "md";
      const h1 = isMd ? "# " : "";
      const h2 = isMd ? "## " : "";
      const li = isMd ? "- " : "・";
      const b = isMd ? "**" : "";

      let content = `${h1}ModParks アカウントデータ エクスポート\n\n`;
      content += `エクスポート日時: ${new Date().toLocaleString("ja-JP")}\n\n`;
      
      content += `${h2}プロフィール情報\n`;
      content += `${li}${b}ユーザーID${b}: ${data.user.id}\n`;
      content += `${li}${b}ユーザー名${b}: ${data.profile?.username}\n`;
      content += `${li}${b}表示名${b}: ${data.profile?.displayName || "(未設定)"}\n`;
      content += `${li}${b}メールアドレス${b}: ${data.user.email}\n`;
      content += `${li}${b}登録日${b}: ${data.user.createdAt ? new Date(data.user.createdAt).toLocaleString("ja-JP") : ""}\n`;
      content += `${li}${b}自己紹介${b}:\n${data.profile?.bio || "(未設定)"}\n\n`;

      content += `${h2}統計\n`;
      content += `${li}${b}公開プロジェクト数${b}: ${data.stats.projectsCount}\n`;
      content += `${li}${b}アイデア投稿数${b}: ${data.stats.ideasCount}\n`;
      content += `${li}${b}コレクション数${b}: ${data.stats.collectionsCount}\n`;
      content += `${li}${b}総コメント数${b}: ${data.stats.commentsCount}\n\n`;

      content += `${h2}プロジェクト一覧\n`;
      if (data.projects.length === 0) {
        content += "プロジェクトはありません。\n";
      } else {
        data.projects.forEach(p => {
          const ext = (p.externalDownloads as Record<string, number>) || {};
          const modrinth = ext.modrinth || 0;
          const curseforge = ext.curseforge || 0;
          
          let dlText = `${p.totalDownloads || p.downloads}`;
          if (modrinth > 0 || curseforge > 0) {
            dlText += ` (ModParks: ${p.downloads}`;
            if (modrinth > 0) dlText += `, Modrinth: ${modrinth}`;
            if (curseforge > 0) dlText += `, CurseForge: ${curseforge}`;
            dlText += `)`;
          } else if (p.totalDownloads && p.totalDownloads !== p.downloads) {
            dlText += ` (ModParks: ${p.downloads})`;
          }

          if (isMd) {
            content += `### ${p.name} (${p.slug})\n${p.description || "説明なし"}\n\n状態: ${p.status}\nDL数: ${dlText}\nタイプ: ${p.type}\n\n`;
          } else {
            content += `${li}${p.name} (${p.slug}) - タイプ: ${p.type}, 状態: ${p.status}, DL数: ${dlText}\n`;
          }
        });
      }
      content += "\n";

      content += `${h2}アイデア一覧\n`;
      if (data.ideas.length === 0) {
        content += "アイデアはありません。\n";
      } else {
        data.ideas.forEach(i => {
          content += `${li}${i.title} - 状態: ${i.status}\n`;
        });
      }
      content += "\n";

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
