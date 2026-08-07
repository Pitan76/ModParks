import type { AppLocale } from "@/lib/i18n/routing";

/**
 * アカウントデータのエクスポート本文の組み立て。
 *
 * 文言は設定画面の言語設定（user_settings.locale）に従う。
 * リクエストのロケールではなく本人の設定を見るのは、エクスポートが
 * 「その人のためのファイル」であって、閲覧中の画面の言語とは独立しているため。
 *
 * ステータスや種別は enum の値をそのまま出す（翻訳しない）。
 * 機械可読なデータとして再取り込みできる形を優先する。
 */

/** 翻訳関数。next-intl の getTranslations から渡す */
export type Translate = (key: string) => string;

/** 日付表記のロケール。表示言語に合わせる */
const DATE_LOCALES: Record<AppLocale, string> = {
  ja: "ja-JP",
  en: "en-US",
};

export const dateLocale = (locale: AppLocale): string => DATE_LOCALES[locale] ?? DATE_LOCALES.ja;

export type ExportData = {
  user: { id?: string; email?: string | null; createdAt?: Date | string | null };
  profile?: { username?: string | null; displayName?: string | null; bio?: string | null } | null;
  stats: { projectsCount: number; ideasCount: number; collectionsCount: number; commentsCount: number };
  projects: {
    slug: string;
    name: string;
    description: string;
    type: string;
    status: string;
    downloads: number;
    totalDownloads: number | null;
    externalDownloads: unknown;
  }[];
  ideas: { title: string; status: string }[];
};

/** CSV の1セルを安全に囲う */
const csvCell = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

/** プロフィールと集計値だけの1行CSV */
export function buildCsv(data: ExportData, t: Translate): string {
  const header = [
    t("userId"),
    t("username"),
    t("displayName"),
    t("email"),
    t("createdAt"),
    t("projectsCount"),
    t("ideasCount"),
    t("listsCount"),
    t("commentsCount"),
  ];

  const row = [
    data.user.id || "",
    data.profile?.username || "",
    data.profile?.displayName || "",
    data.user.email || "",
    data.user.createdAt ? new Date(data.user.createdAt).toISOString() : "",
    data.stats.projectsCount,
    data.stats.ideasCount,
    data.stats.collectionsCount,
    data.stats.commentsCount,
  ];

  return [header.join(","), row.map(csvCell).join(",")].join("\n");
}

/** ダウンロード数の内訳。外部プラットフォーム分があるときだけ括弧で添える */
function downloadsText(project: ExportData["projects"][number]): string {
  const ext = (project.externalDownloads as Record<string, number>) || {};
  const modrinth = ext.modrinth || 0;
  const curseforge = ext.curseforge || 0;

  let text = `${project.totalDownloads || project.downloads}`;
  if (modrinth > 0 || curseforge > 0) {
    text += ` (ModParks: ${project.downloads}`;
    if (modrinth > 0) text += `, Modrinth: ${modrinth}`;
    if (curseforge > 0) text += `, CurseForge: ${curseforge}`;
    text += `)`;
    return text;
  }
  if (project.totalDownloads && project.totalDownloads !== project.downloads) {
    text += ` (ModParks: ${project.downloads})`;
  }
  return text;
}

/** Markdown / プレーンテキストの記号。md のときだけ装飾を付ける */
const marks = (isMd: boolean) => ({
  h1: isMd ? "# " : "",
  h2: isMd ? "## " : "",
  li: isMd ? "- " : "・",
  b: isMd ? "**" : "",
});

/**
 * Markdown またはプレーンテキストのレポートを組み立てる。
 * @param isMd true なら Markdown、false ならプレーンテキスト
 */
export function buildTextReport(data: ExportData, t: Translate, locale: AppLocale, isMd: boolean): string {
  const { h1, h2, li, b } = marks(isMd);
  const notSet = t("notSet");
  const formatDate = (value: Date | string) => new Date(value).toLocaleString(dateLocale(locale));
  const field = (label: string, value: unknown) => `${li}${b}${label}${b}: ${value}\n`;

  let content = `${h1}${t("title")}\n\n`;
  content += `${t("exportedAt")}: ${formatDate(new Date())}\n\n`;

  content += `${h2}${t("profileSection")}\n`;
  content += field(t("userId"), data.user.id);
  content += field(t("username"), data.profile?.username);
  content += field(t("displayName"), data.profile?.displayName || notSet);
  content += field(t("email"), data.user.email);
  content += field(t("registeredAt"), data.user.createdAt ? formatDate(data.user.createdAt) : "");
  content += `${li}${b}${t("bio")}${b}:\n${data.profile?.bio || notSet}\n\n`;

  content += `${h2}${t("statsSection")}\n`;
  content += field(t("projectsCount"), data.stats.projectsCount);
  content += field(t("ideasCount"), data.stats.ideasCount);
  content += field(t("collectionsCount"), data.stats.collectionsCount);
  content += field(t("commentsCount"), data.stats.commentsCount);
  content += "\n";

  content += `${h2}${t("projectsSection")}\n`;
  if (data.projects.length === 0) {
    content += `${t("noProjects")}\n`;
  } else {
    for (const p of data.projects) {
      const dlText = downloadsText(p);
      if (isMd) {
        content += `### ${p.name} (${p.slug})\n${p.description || t("noDescription")}\n\n`;
        content += `${t("status")}: ${p.status}\n${t("downloads")}: ${dlText}\n${t("type")}: ${p.type}\n\n`;
      } else {
        content += `${li}${p.name} (${p.slug}) - ${t("type")}: ${p.type}, ${t("status")}: ${p.status}, ${t("downloads")}: ${dlText}\n`;
      }
    }
  }
  content += "\n";

  content += `${h2}${t("ideasSection")}\n`;
  if (data.ideas.length === 0) {
    content += `${t("noIdeas")}\n`;
  } else {
    for (const idea of data.ideas) {
      content += `${li}${idea.title} - ${t("status")}: ${idea.status}\n`;
    }
  }
  content += "\n";

  return content;
}
