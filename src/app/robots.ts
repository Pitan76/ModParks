import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { locales } from '@/lib/i18n/routing';
import { localePath } from '@/lib/i18n/localePath';

// ログインしないと意味が無い / 検索結果に出す価値の無い画面はクロールさせない
const DISALLOWED_PATHS = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/settings/',
  '/notifications/',
  '/login',
  '/register',
  '/projects/new',
  '/projects/import',
  '/projects/manage',
  '/ideas/new',
] as const;

const robots = (): MetadataRoute.Robots => {
  // 既定ロケール以外は `/en/settings/` のような接頭辞つきURLも存在するため両方を並べる
  const disallow = locales.flatMap((locale) =>
    DISALLOWED_PATHS.map((path) => localePath(path, locale))
  );

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
};

export default robots;
