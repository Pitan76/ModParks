import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform"); // "modrinth" | "curseforge"
    const targetId = searchParams.get("id");

    if (!platform || !targetId) {
      return NextResponse.json({ error: "Platform and ID are required" }, { status: 400 });
    }

    const db = await getDatabase();
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, session.user.id),
    });

    if (platform === "modrinth") {
      const res = await fetch(`https://api.modrinth.com/v2/project/${targetId}`, {
        headers: settings?.modrinthApiKey ? { Authorization: settings.modrinthApiKey } : {},
      });
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch from Modrinth" }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json({
        name: data.title,
        description: data.description,
        iconUrl: data.icon_url,
        type: data.project_type === "mod" ? "mod" : "plugin",
        license: data.license?.name || "All Rights Reserved",
        sourceUrl: data.source_url || "",
        issueTrackerUrl: data.issues_url || "",
        externalDownloads: data.downloads || 0,
        modrinthId: data.id,
      });
    } else if (platform === "curseforge") {
      const cfApiKey = settings?.curseforgeApiKey;
      if (!cfApiKey) {
        return NextResponse.json({ error: "CurseForge API Key is not set in settings" }, { status: 400 });
      }
      const res = await fetch(`https://api.curseforge.com/v1/mods/${targetId}`, {
        headers: { "x-api-key": cfApiKey, "Accept": "application/json" },
      });
      if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch from CurseForge" }, { status: res.status });
      }
      const data = await res.json();
      const mod = data.data;
      return NextResponse.json({
        name: mod.name,
        description: mod.summary,
        iconUrl: mod.logo?.url || null,
        type: "mod",
        license: "All Rights Reserved",
        sourceUrl: mod.links?.sourceUrl || "",
        issueTrackerUrl: mod.links?.issuesUrl || "",
        externalDownloads: mod.downloadCount || 0,
        curseforgeId: mod.id.toString(),
      });
    }

    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });

  } catch (error) {
    console.error("Import API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
