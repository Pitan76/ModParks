import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { getDatabase } from '@/lib/db';
import { projects, ideas, userProfiles, users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// ビルド時は D1 バインディングが無くテーブルを引けないため、リクエスト時に生成する。
export const dynamic = 'force-dynamic';

const LOCALES = ['ja', 'en'];

const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/projects', changeFrequency: 'daily', priority: 0.8 },
  { path: '/terms', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'weekly', priority: 0.8 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}>;

type EntryOptions<T> = {
  items: readonly T[];
  /** ロケールを除いたパス (例: `/projects/my-mod`) */
  pathOf: (item: T) => string;
  lastModifiedOf: (item: T) => Date;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
};

/** 各アイテムを全ロケール分の sitemap エントリへ展開する */
const toEntries = <T>({
  items,
  pathOf,
  lastModifiedOf,
  changeFrequency,
  priority,
}: EntryOptions<T>): MetadataRoute.Sitemap =>
  LOCALES.flatMap((locale) =>
    items.map((item) => ({
      url: `${SITE_URL}/${locale}${pathOf(item)}`,
      lastModified: lastModifiedOf(item),
      changeFrequency,
      priority,
    }))
  );

const staticEntries = (): MetadataRoute.Sitemap =>
  LOCALES.flatMap((locale) =>
    STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}/${locale}${route.path}`,
      lastModified: new Date(),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }))
  );

/** D1 から公開コンテンツを引いて sitemap エントリへ変換する */
const dynamicEntries = async (): Promise<MetadataRoute.Sitemap> => {
  const db = await getDatabase();

  const [dbProjects, dbIdeas, dbUsers] = await Promise.all([
    db
      .select({ slug: projects.slug, updatedAt: projects.updatedAt })
      .from(projects)
      .where(eq(projects.status, 'public'))
      .all(),
    db
      .select({ id: ideas.id, updatedAt: ideas.updatedAt })
      .from(ideas)
      .where(eq(ideas.visibility, 'public'))
      .all(),
    db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(sql`${users.deletedAt} IS NULL`)
      .all(),
  ]);

  return [
    ...toEntries({
      items: dbProjects,
      pathOf: (p) => `/projects/${p.slug}`,
      lastModifiedOf: (p) => p.updatedAt,
      changeFrequency: 'daily',
      priority: 0.7,
    }),
    ...toEntries({
      items: dbIdeas,
      pathOf: (i) => `/ideas/${i.id}`,
      lastModifiedOf: (i) => i.updatedAt,
      changeFrequency: 'daily',
      priority: 0.6,
    }),
    ...toEntries({
      items: dbUsers,
      pathOf: (u) => `/profile/${u.username}`,
      lastModifiedOf: () => new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    }),
  ];
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPart = staticEntries();

  // DB 障害時でも静的エントリだけの sitemap を返し、クローラに 500 を返さない。
  try {
    return [...staticPart, ...(await dynamicEntries())];
  } catch (error) {
    console.error('Failed to generate dynamic sitemap entries:', error);
    return staticPart;
  }
}
