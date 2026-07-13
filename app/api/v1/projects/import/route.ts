import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getConsoleApiKey } from "@/lib/curseforge";

function normalizeLicense(rawLicense: string | undefined | null): string {
  if (!rawLicense) return "All Rights Reserved";
  
  const lower = rawLicense.toLowerCase();
  
  if (lower.includes("mit")) return "MIT";
  if (lower.includes("apache") && lower.includes("2")) return "Apache-2.0";
  if (lower.includes("apache")) return "Apache-2.0";
  if (lower.includes("gpl") && lower.includes("3") && lower.includes("lesser")) return "LGPL-3.0-or-later";
  if (lower.includes("gpl") && lower.includes("3") && lower.includes("affero")) return "AGPL-3.0-or-later";
  if (lower.includes("gpl") && lower.includes("3")) return "GPL-3.0-or-later";
  if (lower.includes("gpl") && lower.includes("2") && lower.includes("lesser")) return "LGPL-2.1-or-later";
  if (lower.includes("gpl") && lower.includes("2")) return "GPL-2.0-or-later";
  if (lower.includes("mpl") || lower.includes("mozilla")) return "MPL-2.0";
  if (lower.includes("cc0") || lower.includes("public domain")) return "CC0-1.0";
  if (lower.includes("cc-by-nc-nd")) return "CC-BY-NC-ND-4.0";
  if (lower.includes("cc-by-nc-sa")) return "CC-BY-NC-SA-4.0";
  if (lower.includes("cc-by-sa")) return "CC-BY-SA-4.0";
  if (lower.includes("cc-by-nc")) return "CC-BY-NC-4.0";
  if (lower.includes("cc-by-nd")) return "CC-BY-ND-4.0";
  if (lower.includes("cc-by")) return "CC-BY-4.0";
  if (lower.includes("creative commons")) return "CC-BY-4.0";
  if (lower.includes("bsd") && lower.includes("3")) return "BSD-3-Clause";
  if (lower.includes("bsd") && lower.includes("2")) return "BSD-2-Clause";
  if (lower.includes("wtfpl")) return "WTFPL";
  if (lower.includes("unlicense")) return "Unlicense";
  
  return rawLicense;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform"); // "modrinth" | "curseforge"
    let targetId = searchParams.get("id");

    if (!platform || !targetId) {
      return NextResponse.json({ error: "Platform and ID are required" }, { status: 400 });
    }

    let projectUrl = "";
    if (targetId.startsWith("http")) {
      projectUrl = targetId;
      try {
        const url = new URL(targetId);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (platform === "modrinth") {
          if (pathParts.length >= 2) targetId = pathParts[1];
        } else if (platform === "curseforge") {
          if (pathParts.length >= 3) targetId = pathParts[pathParts.length - 1];
        }
      } catch (e) {
        // ignore
      }
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
      const data = (await res.json()) as any;
      if (!projectUrl) projectUrl = `https://modrinth.com/mod/${data.slug}`;
      return NextResponse.json({
        name: data.title,
        description: data.description,
        iconUrl: data.icon_url,
        type: data.project_type === "mod" ? "mod" : "plugin",
        license: normalizeLicense(data.license?.name),
        sourceUrl: data.source_url || "",
        issueTrackerUrl: data.issues_url || "",
        externalDownloads: data.downloads || 0,
        modrinthId: data.id,
        projectUrl,
      });
    } else if (platform === "curseforge") {
      // 読み取りは運営設定の共通コンソールキーを使用
      let cfApiKey: string;
      try {
        cfApiKey = getConsoleApiKey();
      } catch {
        return NextResponse.json({ error: "CurseForge integration is not configured on the server" }, { status: 503 });
      }
      let mod = null;
      if (!/^\d+$/.test(targetId)) {
        const searchRes = await fetch(`https://api.curseforge.com/v1/mods/search?gameId=432&slug=${targetId}`, {
          headers: { "x-api-key": cfApiKey, "Accept": "application/json" },
        });
        if (!searchRes.ok) return NextResponse.json({ error: "Failed to search CurseForge" }, { status: searchRes.status });
        const searchData = (await searchRes.json()) as any;
        if (!searchData.data || searchData.data.length === 0) {
          return NextResponse.json({ error: "CurseForge project not found by slug" }, { status: 404 });
        }
        mod = searchData.data[0];
      } else {
        const res = await fetch(`https://api.curseforge.com/v1/mods/${targetId}`, {
          headers: { "x-api-key": cfApiKey, "Accept": "application/json" },
        });
        if (!res.ok) {
          return NextResponse.json({ error: "Failed to fetch from CurseForge" }, { status: res.status });
        }
        const data = (await res.json()) as any;
        mod = data.data;
      }

      if (!projectUrl) projectUrl = `https://www.curseforge.com/minecraft/mc-mods/${mod.slug}`;

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
        projectUrl,
      });
    }

    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });

  } catch (error) {
    console.error("Import API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
