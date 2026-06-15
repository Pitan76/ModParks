import { type NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";



export async function GET(req: NextRequest) {
  try {
    const d1 = await getD1();
    
    // Execute the exact query that is failing
    const query = `select "projects"."id", "projects"."slug", "projects"."name", "projects"."description", "projects"."icon_url", "projects"."type", "projects"."license", "projects"."source_url", "projects"."links", "projects"."status", "projects"."author_id", "projects"."downloads", "projects"."created_at", "projects"."updated_at", "users"."username", "users"."display_name", "users"."avatar_url" from "projects" left join "users" on "projects"."author_id" = "users"."id" where "projects"."status" = ? order by "projects"."created_at" desc limit ?`;
    
    let result = null;
    let queryError = null;
    try {
      result = await d1.prepare(query).bind("public", 6).all();
    } catch (e: any) {
      queryError = { message: e.message, cause: e.cause };
    }

    // sqlite_master からテーブル定義を取得
    const usersSchema = await d1.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").first<{ sql: string }>();
    const projectsSchema = await d1.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").first<{ sql: string }>();

    return NextResponse.json({
      queryResult: result,
      queryError,
      usersSchema: usersSchema?.sql,
      projectsSchema: projectsSchema?.sql,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "modparks_debug_schema_secret") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const d1 = await getD1();
    const results = [];
    
    // 0010_aberrant_ken_ellis.sql の変更を手動で適用
    try {
      const res1 = await d1.prepare("ALTER TABLE `projects` ADD `links` text").run();
      results.push({ q: "alter projects", success: true, res: res1 });
    } catch (e: any) {
      results.push({ q: "alter projects", success: false, error: e.message });
    }

    try {
      const res2 = await d1.prepare("ALTER TABLE `users` ADD `locale` text DEFAULT 'ja' NOT NULL").run();
      results.push({ q: "alter users locale", success: true, res: res2 });
    } catch (e: any) {
      results.push({ q: "alter users locale", success: false, error: e.message });
    }

    try {
      const res3 = await d1.prepare("ALTER TABLE `users` ADD `links` text").run();
      results.push({ q: "alter users links", success: true, res: res3 });
    } catch (e: any) {
      results.push({ q: "alter users links", success: false, error: e.message });
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
