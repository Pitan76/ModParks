"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Link } from "@/lib/i18n/routing";
import { formatCompactNumber } from "@/lib/utils/format";
import type { ProjectCardProps } from "@/components/project/ProjectCard";
import styles from "../plain.module.css";

type PlainProject = ProjectCardProps["project"];

export type PlainProjectTableProps = {
  projects: PlainProject[];
};

/** 行が横に伸びすぎないよう表示するタグ数を抑える */
const VISIBLE_TAG_COUNT = 3;

/**
 * Plain Theme 用のプロジェクト一覧。
 * 標準の table のみで構成し、画像・プリフェッチ・スタイル生成を最小限にする。
 */
const PlainProjectTable = ({ projects }: PlainProjectTableProps) => {
  const locale = useLocale();
  const format = useFormatter();
  const tProject = useTranslations("Project");

  return (
    <div className={styles.tableScroll}>
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">{tProject("table.name")}</th>
          <th scope="col">{tProject("table.author")}</th>
          <th scope="col" className={styles.numeric}>{tProject("table.downloads")}</th>
          <th scope="col">{tProject("table.updated")}</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} id={`project-row-${project.slug}`}>
            <td>
              {/* 一覧の全件をプリフェッチすると通信量が増えるため無効にする */}
              <Link href={`/projects/${project.slug}`} prefetch={false} className={styles.nameLink}>
                {project.iconUrl ? (
                  // next/image は最適化のための追加処理を伴うため、軽量化を優先して素の img を使う
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.iconUrl} alt="" className={styles.icon} loading="lazy" decoding="async" />
                ) : (
                  <span className={styles.iconFallback} aria-hidden="true" />
                )}
                {project.title}
              </Link>
              {project.tags?.length > 0 && (
                <span className={styles.tags}>
                  {project.tags.slice(0, VISIBLE_TAG_COUNT).map((tag) => (
                    <Link key={tag} href={`/projects?tags=${encodeURIComponent(tag)}`} prefetch={false}>
                      #{tag}
                    </Link>
                  ))}
                  {project.tags.length > VISIBLE_TAG_COUNT && (
                    <span className={styles.dim}>+{project.tags.length - VISIBLE_TAG_COUNT}</span>
                  )}
                </span>
              )}
            </td>
            <td>
              {project.authorUsername ? (
                <Link href={`/profile/${project.authorUsername}`} prefetch={false}>
                  {project.authorDisplayName || project.authorUsername}
                </Link>
              ) : (
                project.authorDisplayName || "Unknown"
              )}
            </td>
            <td className={styles.numeric}>
              {formatCompactNumber(project.totalDownloads ?? project.downloads, locale)}
            </td>
            <td>
              <time dateTime={new Date(project.updatedAt).toISOString()}>
                {format.dateTime(new Date(project.updatedAt), { dateStyle: "short" })}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default PlainProjectTable;
