import { MetadataRoute } from 'next';
import { canonicalUrl, languageAlternates } from '@/lib/seo/canonical';
import { getDatabase } from '@/lib/db';
import { posts, postTranslations, userProfiles, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// ビルド時は D1 バインディングが無くテーブルを引けないため、リクエスト時に生成する。
export const dynamic = 'force-dynamic';

// URL は既定ロケール(日本語)の接頭辞なし版を載せ、他言語は alternates.languages で並記する。
const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1 },
  { path: '/projects', changeFrequency: 'daily', priority: 0.8 },
  { path: '/ideas', changeFrequency: 'daily', priority: 0.6 },
  { path: '/terms', changeFrequency: 'weekly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'weekly', priority: 0.3 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}>;

type EntryOptions<T> = {
  items: readonly T[];
  /** サイトルートからのパス (例: `/projects/my-mod`) */
  pathOf: (item: T) => string;
  lastModifiedOf: (item: T) => Date;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
  /** hreflang に載せる言語。省略時は全ロケール */
  localesOf?: (item: T) => readonly string[];
};

/** 各アイテムを sitemap エントリへ変換する */
const toEntries = <T>({
  items,
  pathOf,
  lastModifiedOf,
  changeFrequency,
  priority,
  localesOf,
}: EntryOptions<T>): MetadataRoute.Sitemap =>
  items.map((item) => ({
    url: canonicalUrl(pathOf(item)),
    lastModified: lastModifiedOf(item),
    changeFrequency,
    priority,
    alternates: { languages: languageAlternates(pathOf(item), localesOf?.(item)) },
  }));

const staticEntries = (): MetadataRoute.Sitemap =>
  STATIC_ROUTES.map((route) => ({
    url: canonicalUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: { languages: languageAlternates(route.path) },
  }));

/** 投稿ID → 手動確定済みの訳文がある言語。索引対象を絞るために使う */
const manualTranslationLocales = async (
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<Map<string, string[]>> => {
  const rows = await db
    .select({ postId: postTranslations.postId, locale: postTranslations.locale })
    .from(postTranslations)
    .where(eq(postTranslations.state, 'manual'))
    .all();

  const byPost = new Map<string, string[]>();
  for (const row of rows) byPost.set(row.postId, [...(byPost.get(row.postId) ?? []), row.locale]);
  return byPost;
};

/** D1 から公開コンテンツを引いて sitemap エントリへ変換する */
const dynamicEntries = async (): Promise<MetadataRoute.Sitemap> => {
  const db = await getDatabase();

  const [dbProjects, dbIdeas, dbUsers] = await Promise.all([
    db
      .select({ id: posts.id, slug: posts.slug, updatedAt: posts.updatedAt, sourceLocale: posts.sourceLocale })
      .from(posts)
      .where(and(eq(posts.kind, 'project'), eq(posts.visibility, 'public')))
      .all(),
    db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(and(eq(posts.kind, 'idea'), eq(posts.visibility, 'public')))
      .all(),
    db
      .select({ username: userProfiles.username })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(sql`${users.deletedAt} IS NULL`)
      .all(),
  ]);

  // 機械翻訳しか無い言語は各ページの hreflang にも載せていないので、sitemap でも載せない
  const manualLocales = await manualTranslationLocales(db);

  return [
    ...toEntries({
      items: dbProjects,
      pathOf: (p) => `/projects/${p.slug}`,
      lastModifiedOf: (p) => p.updatedAt,
      changeFrequency: 'daily',
      priority: 0.7,
      localesOf: (p) => [p.sourceLocale, ...(manualLocales.get(p.id) ?? [])],
    }),
    ...toEntries({
      items: dbIdeas,
      pathOf: (i) => `/ideas/${i.slug}`,
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
