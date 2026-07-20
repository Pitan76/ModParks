import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { getDatabase } from '@/lib/db';
import { projects, ideas, userProfiles, users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['ja', 'en'];
  const routes = [
    '',
    '/projects',
    '/terms',
    '/privacy'
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Static routes
  for (const locale of locales) {
    for (const route of routes) {
      sitemapEntries.push({
        url: `${SITE_URL}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' || route === '/projects' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : 0.8,
      });
    }
  }

  try {
    const db = await getDatabase();

    const [dbProjects, dbIdeas, dbUsers] = await Promise.all([
      db.select({ slug: projects.slug, updatedAt: projects.updatedAt }).from(projects).where(eq(projects.status, 'public')).all(),
      db.select({ id: ideas.id, updatedAt: ideas.updatedAt }).from(ideas).where(eq(ideas.visibility, 'public')).all(),
      db.select({ username: userProfiles.username }).from(userProfiles).innerJoin(users, eq(userProfiles.userId, users.id)).where(sql`${users.deletedAt} IS NULL`).all()
    ]);

    // Project detail pages
    for (const locale of locales) {
      for (const p of dbProjects) {
        sitemapEntries.push({
          url: `${SITE_URL}/${locale}/projects/${p.slug}`,
          lastModified: p.updatedAt,
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }

    // Idea detail pages
    for (const locale of locales) {
      for (const idea of dbIdeas) {
        sitemapEntries.push({
          url: `${SITE_URL}/${locale}/ideas/${idea.id}`,
          lastModified: idea.updatedAt,
          changeFrequency: 'daily',
          priority: 0.6,
        });
      }
    }

    // Profile pages
    for (const locale of locales) {
      for (const u of dbUsers) {
        sitemapEntries.push({
          url: `${SITE_URL}/${locale}/profile/${u.username}`,
          lastModified: new Date(),
          changeFrequency: 'weekly',
          priority: 0.5,
        });
      }
    }
  } catch (error) {
    console.error('Failed to generate dynamic sitemap entries:', error);
  }

  return sitemapEntries;
}
