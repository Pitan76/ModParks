"use client";

import { useTranslations } from "next-intl";
import styles from "../plain.module.css";

export type PlainPaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  currentLimit: number;
  limitOptions: number[];
  /** ページ番号から遷移先URLを組み立てる */
  buildPageHref: (page: number) => string;
  onLimitChange: (limit: number) => void;
};

/** 現在ページの前後に表示するページ番号の数 */
const PAGE_WINDOW = 2;

/**
 * 現在ページ周辺のページ番号を返す。総ページ数が少ない場合はすべて返す。
 */
const getVisiblePages = (currentPage: number, totalPages: number): number[] => {
  const start = Math.max(1, currentPage - PAGE_WINDOW);
  const end = Math.min(totalPages, currentPage + PAGE_WINDOW);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

/**
 * Plain Theme 用のページ送り。
 * ページ番号は素のリンクにしてJSなしで遷移でき、件数切り替えのみ標準の select を使う。
 */
const PlainPaginationControls = ({
  currentPage,
  totalPages,
  currentLimit,
  limitOptions,
  buildPageHref,
  onLimitChange,
}: PlainPaginationControlsProps) => {
  const t = useTranslations("Common");
  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <nav className={styles.pagination}>
      <span>
        {currentPage > 1 && <a href={buildPageHref(currentPage - 1)}>&laquo;</a>}
        {pages[0] > 1 && <a href={buildPageHref(1)}>1</a>}
        {pages[0] > 2 && <span className={styles.dim}>…</span>}
        {pages.map((page) =>
          page === currentPage ? (
            <strong key={page} aria-current="page">{page}</strong>
          ) : (
            <a key={page} href={buildPageHref(page)}>{page}</a>
          )
        )}
        {pages[pages.length - 1] < totalPages - 1 && <span className={styles.dim}>…</span>}
        {pages[pages.length - 1] < totalPages && <a href={buildPageHref(totalPages)}>{totalPages}</a>}
        {currentPage < totalPages && <a href={buildPageHref(currentPage + 1)}>&raquo;</a>}
      </span>

      <label>
        {t("itemsPerPage")}:{" "}
        <select value={currentLimit} onChange={(e) => onLimitChange(Number(e.target.value))}>
          {limitOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
    </nav>
  );
};

export default PlainPaginationControls;
