import { NextResponse } from "next/server";
import { getDb, getD1 } from "@/lib/db";
import { projects, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";



export async function GET() {
  const d1 = await getD1();
  const db = getDb(d1);

  const updatedProjects = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      author: {
        username: users.username,
        displayName: users.displayName,
      }
    })
    .from(projects)
    .leftJoin(users, eq(projects.authorId, users.id))
    .where(eq(projects.status, "published"))
    .orderBy(desc(projects.updatedAt))
    .limit(20);

  const siteUrl = "https://modparks.pages.dev";

  const itemsXml = updatedProjects.map(project => {
    const authorName = project.author?.displayName || project.author?.username || "Unknown";
    const projectUrl = `${siteUrl}/projects/${project.slug}`;
    const pubDate = new Date(project.updatedAt).toUTCString();

    return `
    <item>
      <title><![CDATA[${project.name}]]></title>
      <link>${projectUrl}</link>
      <guid isPermaLink="true">${projectUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${project.description}]]></description>
      <author>${authorName}</author>
    </item>`;
  }).join("");

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ModParks - 更新されたプロジェクト</title>
    <link>${siteUrl}</link>
    <description>Minecraft Java Edition向けのMod/Pluginプラットフォーム - 最近更新されたプロジェクト</description>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed-updated.xml" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(rssFeed, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
