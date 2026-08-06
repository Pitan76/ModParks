"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { formatCompactNumber } from "@/lib/utils/format";
import { toPlainDescription } from "@/lib/utils/plainText";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import styles from "../plain.module.css";

/** タグ数が多いカードでも行が伸びすぎないよう表示数を抑える */
const VISIBLE_TAG_COUNT = 4;

/**
 * Plain Theme 用のプロジェクトカード。
 * MUIを使わず標準HTMLのみで構成し、DOM数とスタイル生成を抑える。
 * 表示するデータと遷移先は ProjectCard と同一。
 */
const PlainProjectCard = ({ project }: Pick<ProjectCardProps, "project">) => {
  const locale = useLocale();
  const format = useFormatter();
  const tProject = useTranslations("Project");
  const total = project.totalDownloads ?? project.downloads;
  const author = project.authorDisplayName || project.authorUsername || "Unknown";
  const tags = project.tags ?? [];

  return (
    <Link href={`/projects/${project.slug}`} className={styles.card} id={`project-card-${project.slug}`}>
      {project.iconUrl ? (
        // next/image は最適化のための追加処理を伴うため、軽量化を優先して素の img を使う
        // eslint-disable-next-line @next/next/no-img-element
        <img src={project.iconUrl} alt="" className={styles.icon} loading="lazy" decoding="async" />
      ) : (
        <span className={styles.iconFallback} aria-hidden="true" />
      )}

      <div className={styles.main}>
        <h3 className={styles.title}>{project.title}</h3>
        <p className={`${styles.body} ${styles.dim}`}>{toPlainDescription(project.body)}</p>

        <p className={`${styles.meta} ${styles.dim}`}>
          <span>{author}</span>
          <span>{formatCompactNumber(total, locale)} DL</span>
          <time dateTime={new Date(project.updatedAt).toISOString()}>
            {tProject("header.updatedAt", { date: format.dateTime(new Date(project.updatedAt), { dateStyle: "short" }) })}
          </time>
        </p>

        {tags.length > 0 && (
          <ul className={`${styles.tags} ${styles.dim}`}>
            {tags.slice(0, VISIBLE_TAG_COUNT).map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
            {tags.length > VISIBLE_TAG_COUNT && <li>+{tags.length - VISIBLE_TAG_COUNT}</li>}
          </ul>
        )}
      </div>
    </Link>
  );
};

export default PlainProjectCard;
