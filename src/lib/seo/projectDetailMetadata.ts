import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { getProjectBySlug } from "@/lib/actions/projectQuery";
import { findMetadataTranslation, listIndexableLocales } from "@/lib/translation/metadata";
import { toPlainDescription } from "@/lib/utils/plainText";
import { SITE_URL } from "@/lib/config";
import { canonicalUrl, seoAlternates } from "@/lib/seo/canonical";

/**
 * プロジェクト詳細ページの `generateMetadata` 本体。
 * ページコンポーネントから切り出し、OGP/SEO 用の組み立てだけに責務を絞る。
 */
export async function buildProjectDetailMetadata({ locale, slug }: { locale: string; slug: string }) {
  const [project, session] = await Promise.all([
    getProjectBySlug(slug),
    auth(),
  ]);

  if (!project) return { title: "Not Found", robots: { index: false, follow: false } };

  const isOwner = session?.user?.id === project.authorId;
  const isViewable = project.visibility === "public" || project.visibility === "unlisted" || isOwner;

  if (!isViewable) return { title: "Not Found", robots: { index: false, follow: false } };

  // 一覧・OGP・<title> は cached も含めて訳文を使う（表示の一貫性を優先）
  const db = await getDatabase();
  const translation = locale === project.sourceLocale
    ? null
    : await findMetadataTranslation(db, project.id, locale);

  // Mod 名は固有名詞なので訳さない。説明文だけ訳文を使う
  const title = project.title;
  const plainDesc = toPlainDescription(translation?.body ?? project.body);
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });
  const description = plainDesc.length > 150
    ? plainDesc.substring(0, 150) + "..."
    : plainDesc || tMeta("projectFallbackDescription");
  const imageUrl = project.iconUrl || SITE_URL + "/icon.png";

  // 統合先がある場合は canonical を統合先に向け、重複ページとして扱わせない
  const canonicalSlug = project.redirectSlug || project.slug;
  const path = `/projects/${canonicalSlug}`;
  const url = canonicalUrl(path, locale);

  // unlisted / draft / private は URL を知る人だけのものなので検索結果に出さない
  const isIndexable = project.visibility === "public" && !project.redirectSlug;

  return {
    title,
    description,
    robots: isIndexable ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: 512,
          height: 512,
        },
      ],
    },
    // 機械翻訳しかない言語は hreflang に載せない
    alternates: seoAlternates(path, locale, await listIndexableLocales(db, project.id, project.sourceLocale)),
  };
}
