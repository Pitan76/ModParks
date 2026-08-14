import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { locales } from '@/lib/i18n/routing';
import { localePath } from '@/lib/i18n/localePath';
import { isUnprefixedRoute } from '@/lib/i18n/unprefixedRoutes';

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
  // 接頭辞なしルートは `/en/...` が存在しないので既定ロケール分だけでよい。
  // それ以外（ログイン画面など）は `/en/login` も実在するため全ロケール分を並べる
  const disallow = DISALLOWED_PATHS.flatMap((path) =>
    isUnprefixedRoute(path) ? [path] : locales.map((locale) => localePath(path, locale))
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
