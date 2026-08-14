"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { formatCompactNumber } from "@/lib/utils/format";
import { useLocale } from "next-intl";
import type { ProjectDetailHeaderProps } from "@/components/project/ProjectDetailHeader";
import ProjectFavoriteButton from "@/components/project/ProjectFavoriteButton";
import AddToCollectionButton from "@/components/project/AddToCollectionButton";
import styles from "../plain.module.css";
import { useState, useEffect } from "react";
import { imageUrl } from "@/lib/utils/imageUrl";

/**
 * Plain Theme 用のプロジェクト詳細ヘッダー。
 * 見出し・作者・統計を素のHTMLで並べ、操作系はお気に入りとコレクション追加のみ残す。
 */
const PlainProjectDetailHeader = ({
  project: p,
  isFavorited,
  favoritesCount,
  isLoggedIn,
  currentUserId,
}: ProjectDetailHeaderProps) => {
  const t = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const locale = useLocale();
  const authorName = p.author?.displayName || p.author?.username;
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

  return (
    <header className={styles.detailHeader}>
      <nav className={styles.dim}>
        <Link href="/projects" prefetch={false}>{tCommon("projects")}</Link> / {p.title}
      </nav>

      <div className={styles.nameCell}>
        {p.iconUrl && (
          // next/image は最適化のための追加処理を伴うため、軽量化を優先して素の img を使う
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(p.iconUrl, { w: 200 })} alt="" className={styles.detailIcon} decoding="async" />
        )}
        <h1>{p.title}</h1>
        <span className={styles.dim}>{t.has(`type.${p.type}`) ? t(`type.${p.type}`) : p.type}</span>
        {p.visibility !== "public" && <span className={styles.dim}>{tCommon(`visibility.${p.visibility}`)}</span>}
      </div>

      <p className={styles.searchRow}>
        {p.author?.username ? (
          <Link href={`/profile/${p.author.username}`} prefetch={false}>{authorName}</Link>
        ) : (
          <span>{authorName ?? "Unknown"}</span>
        )}
        <span className={styles.dim}>
          {formatCompactNumber(p.totalDownloads ?? p.downloads, locale)} DL
        </span>
        <span className={styles.dim}>
          {t("createdAt")}: <time dateTime={new Date(p.createdAt).toISOString()}>{format.dateTime(new Date(p.createdAt), { dateStyle: "short" })}</time>
        </span>
        <span className={styles.dim}>
          {t("table.updated")}: <time dateTime={new Date(p.updatedAt).toISOString()}>{format.dateTime(new Date(p.updatedAt), { dateStyle: "short" })}</time>
        </span>
      </p>

      {p.sourceIdeaId && p.sourceIdeaTitle && (
        <p>
          <Link href={`/ideas/${p.sourceIdeaId}`} prefetch={false}>{p.sourceIdeaTitle}</Link>
        </p>
      )}

      <p className={styles.searchRow}>
        <ProjectFavoriteButton
          projectId={p.id}
          initialCount={favoritesCount}
          initialFavorited={isFavorited}
          isLoggedIn={isLoggedIn}
          variant="icon"
        />
        {isLoggedIn && currentUserId && (
          <AddToCollectionButton projectId={p.id} userId={currentUserId} variant="icon" />
        )}
      </p>
    </header>
  );
};

export default PlainProjectDetailHeader;
