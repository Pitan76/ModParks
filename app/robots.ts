import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

const robots = (): MetadataRoute.Robots => {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // ログインしないと意味が無い / 検索結果に出す価値の無い画面はクロールさせない
      disallow: [
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
        '/*/api/',
        '/*/admin/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
};

export default robots;
