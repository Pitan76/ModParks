"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { parseLinks } from "@/lib/utils/links";
import ReportDialog from "@/components/project/ReportDialog";
import type { ProjectSidebarProps } from "@/components/project/ProjectSidebar";
import styles from "../plain.module.css";

/**
 * Plain Theme 用のプロジェクトサイドバー。
 * 定義リストと素のリンクで構成し、アイコンやボタン装飾は持たない。
 */
const PlainProjectSidebar = ({ project: p, isAuthenticated }: ProjectSidebarProps) => {
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");
  const links = parseLinks(p.links);

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return tTags.has(key) ? tTags(key) : tag;
  };

  return (
    <aside>
      <dl className={styles.definitions}>
        <dt>{t("sidebar.license")}</dt>
        <dd>{p.license}</dd>

        {p.sourceUrl && (
          <>
            <dt>{t("sidebar.sourceCode")}</dt>
            <dd>
              <a id="source-code-btn" href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{p.sourceUrl}</a>
            </dd>
          </>
        )}

        {links.length > 0 && (
          <>
            <dt>{t("fields.linksSection")}</dt>
            <dd>
              <ul className={styles.plainList}>
                {links.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}

        {p.tags.length > 0 && (
          <>
            <dt>{t("sidebar.tags")}</dt>
            <dd>
              <ul className={styles.tags}>
                {p.tags.map((tag) => (
                  <li key={tag}>
                    <Link href={`/projects?tags=${encodeURIComponent(tag)}`} prefetch={false}>
                      {getTagLabel(tag)}
                    </Link>
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>

      {isAuthenticated && <ReportDialog targetType="project" targetId={p.id} />}
    </aside>
  );
};

export default PlainProjectSidebar;
