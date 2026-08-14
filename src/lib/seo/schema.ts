import { SITE_URL } from "@/lib/config";
import { SITE_NAME, canonicalUrl } from "@/lib/seo/canonical";

/**
 * サイト名を検索結果に表示させるための WebSite 構造化データ。
 *
 * Google はドメイン（サブドメイン含む）のトップページ1箇所しか見ないため、
 * レイアウトではなくトップページからのみ出力すること。
 */
export function websiteSchema(description: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    name: SITE_NAME,
    alternateName: ["モドパークス", "modparks"],
    url: SITE_URL,
    description,
    inLanguage: ["ja", "en"],
    publisher: { "@id": `${SITE_URL}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/projects?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** WebSite の publisher として参照される運営組織 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icon.png`,
      width: 500,
      height: 500,
    },
  };
}

type ProjectSchemaInput = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  authorName?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  downloadCount?: number | null;
};

/** @param date null/undefined の場合はプロパティごと省略するため undefined を返す */
function toIsoDate(date: Date | string | null | undefined): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

/**
 * プロジェクト詳細ページの SoftwareApplication 構造化データ。
 * Minecraft の MOD/プラグインなので applicationCategory は GameApplication とする。
 */
export function projectSchema(project: ProjectSchemaInput, locale?: string): Record<string, unknown> {
  const url = canonicalUrl(`/projects/${project.slug}`, locale);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${url}#software`,
    name: project.title,
    description: project.description,
    url,
    image: project.imageUrl,
    applicationCategory: "GameApplication",
    operatingSystem: "Windows, macOS, Linux",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    offers: { "@type": "Offer", price: 0, priceCurrency: "JPY" },
  };

  if (project.authorName) schema.author = { "@type": "Person", name: project.authorName };

  const datePublished = toIsoDate(project.createdAt);
  if (datePublished) schema.datePublished = datePublished;

  const dateModified = toIsoDate(project.updatedAt);
  if (dateModified) schema.dateModified = dateModified;

  return schema;
}

/**
 * @param trail ルートを除いた階層（[{ name, path }] の順に並べる）
 * @param locale ページのロケール。canonical と同じURLを指すために渡す
 */
export function breadcrumbSchema(
  trail: { name: string; path: string }[],
  locale?: string,
): Record<string, unknown> {
  const items = [{ name: SITE_NAME, path: "" }, ...trail];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path, locale),
    })),
  };
}
