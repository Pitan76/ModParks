import { type NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/db";



export async function GET(req: NextRequest) {
  try {
    const d1 = await getD1();
    
    // sqlite_master からテーブル定義を取得
    const usersSchema = await d1.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").first<{ sql: string }>();
    const projectsSchema = await d1.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'").first<{ sql: string }>();
    
    // 存在するカラムの一覧を取得
    const usersInfo = await d1.prepare("PRAGMA table_info(users)").all();
    const projectsInfo = await d1.prepare("PRAGMA table_info(projects)").all();

    return NextResponse.json({
      usersSchema: usersSchema?.sql,
      projectsSchema: projectsSchema?.sql,
      usersColumns: usersInfo.results,
      projectsColumns: projectsInfo.results,
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
