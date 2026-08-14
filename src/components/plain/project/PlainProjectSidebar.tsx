"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { parseLinks } from "@/lib/utils/links";
import ReportDialog from "@/components/project/ReportDialog";
import type { ProjectSidebarProps } from "@/components/project/ProjectSidebar";
import { summarizeProjectVersions } from "@/lib/utils/projectVersionSummary";
import { getLoaderName } from "@/lib/data/loaderIds";
import styles from "../plain.module.css";
import { useState, useEffect } from "react";

/**
 * Plain Theme 用のプロジェクトサイドバー。
 * 定義リストと素のリンクで構成し、アイコンやボタン装飾は持たない。
 */
const PlainProjectSidebar = ({ project: p, isAuthenticated }: ProjectSidebarProps) => {
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");
  const links = parseLinks(p.links);
  const { mcVersions, loaders } = summarizeProjectVersions(p.versions);
  const [showAiLabel, setShowAiLabel] = useState(true);

  useEffect(() => {
    try {
      const val = window.localStorage.getItem("show_ai_label");
      if (val === "false") {
        setShowAiLabel(false);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    return tTags.has(key) ? tTags(key) : tag;
  };

  return (
    <aside>
      <dl className={styles.definitions}>
        {loaders.length > 0 && (
          <>
            <dt>{t("infobox.platforms")}</dt>
            <dd>{loaders.map(getLoaderName).join(", ")}</dd>
          </>
        )}

        {mcVersions.length > 0 && (
          <>
            <dt>{t("infobox.gameVersions")}</dt>
            <dd>{mcVersions.join(", ")}</dd>
          </>
        )}

        {showAiLabel && p.aiGenerated && (
          <>
            <dt title={t("infobox.aiGeneratedDesc")} style={{ cursor: "help" }}>
              {t("infobox.aiGenerated")}
            </dt>
            <dd>{t("infobox.aiGeneratedYes")}</dd>
          </>
        )}

        <dt>{t("infobox.license")}</dt>
        <dd>{p.license}</dd>

        {p.sourceUrl && (
          <>
            <dt>{t("infobox.sourceCode")}</dt>
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
            <dt>{t("infobox.tags")}</dt>
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
