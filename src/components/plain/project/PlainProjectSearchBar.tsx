"use client";

import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CONTENT_TYPES } from "@/lib/data/projectTypes";
import type { AdvancedSearchFilters } from "@/components/project/AdvancedSearchDialog";
import styles from "../plain.module.css";

export type PlainProjectSearchBarProps = {
  initialQ: string;
  initialTypes: string[];
  initialSort: string;
  initialFilters: AdvancedSearchFilters;
  onSubmit: (q: string, types: string[], sort: string, filters: AdvancedSearchFilters) => void;
};

/** カンマ区切りの入力値を配列へ変換する */
const splitList = (value: string): string[] =>
  value.split(",").map((item) => item.trim()).filter(Boolean);

/**
 * Plain Theme 用の検索バー。
 * ダイアログや Autocomplete を使わず、form + details と標準の入力要素のみで構成する。
 * 入力中の自動検索は行わず、送信時にのみ遷移する。
 */
const PlainProjectSearchBar = ({
  initialQ,
  initialTypes,
  initialSort,
  initialFilters,
  onSubmit,
}: PlainProjectSearchBarProps) => {
  const t = useTranslations("Search");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const types = data.getAll("types").map(String);

    onSubmit(String(data.get("q") ?? ""), types, String(data.get("sort") ?? "updated"), {
      author: String(data.get("author") ?? ""),
      loaders: splitList(String(data.get("loaders") ?? "")),
      mcVersions: splitList(String(data.get("mcVersions") ?? "")),
      tags: splitList(String(data.get("tags") ?? "")),
      licenses: splitList(String(data.get("licenses") ?? "")),
      searchMode: String(data.get("searchMode") ?? "OR"),
      includeDesc: data.get("includeDesc") !== null,
      includeTags: data.get("includeTags") !== null,
      includeAuthor: data.get("includeAuthor") !== null,
      includeExtDl: data.get("includeExtDl") !== null,
    });
  };

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit}>
      <p className={styles.searchRow}>
        <input type="search" name="q" defaultValue={initialQ} placeholder={t("placeholder")} className={styles.grow} />
        <label>
          {t("sort.label")}:{" "}
          <select name="sort" defaultValue={initialSort}>
            <option value="updated">{t("sort.updated")}</option>
            <option value="downloads">{t("sort.downloads")}</option>
            <option value="newest">{t("sort.newest")}</option>
          </select>
        </label>
        <button type="submit">{t("apply")}</button>
      </p>

      <details>
        <summary>{t("filters.type")}</summary>
        <p className={styles.searchRow}>
          {CONTENT_TYPES.map((type) => (
            <label key={type}>
              <input type="checkbox" name="types" value={type} defaultChecked={initialTypes.includes(type)} />
              {t(`filters.${type}`)}
            </label>
          ))}
        </p>
      </details>

      <details>
        <summary>{t("advancedSearch")}</summary>
        <p className={styles.searchRow}>
          <label>
            {t("author")}: <input type="text" name="author" defaultValue={initialFilters.author ?? ""} />
          </label>
          <label>
            {t("platforms")}: <input type="text" name="loaders" defaultValue={initialFilters.loaders.join(", ")} />
          </label>
          <label>
            {t("mcVersions")}: <input type="text" name="mcVersions" defaultValue={initialFilters.mcVersions.join(", ")} />
          </label>
          <label>
            {t("tags")}: <input type="text" name="tags" defaultValue={initialFilters.tags.join(", ")} />
          </label>
          <label>
            {t("licenses")}: <input type="text" name="licenses" defaultValue={initialFilters.licenses.join(", ")} />
          </label>
        </p>

        <fieldset className={styles.searchRow}>
          <legend>{t("keywordOptions")}</legend>
          <label>
            <input type="radio" name="searchMode" value="OR" defaultChecked={initialFilters.searchMode !== "AND"} />
            OR
          </label>
          <label>
            <input type="radio" name="searchMode" value="AND" defaultChecked={initialFilters.searchMode === "AND"} />
            AND
          </label>
          <label>
            <input type="checkbox" name="includeDesc" defaultChecked={initialFilters.includeDesc} />
            {t("includeDesc")}
          </label>
          <label>
            <input type="checkbox" name="includeTags" defaultChecked={initialFilters.includeTags} />
            {t("includeTags")}
          </label>
          <label>
            <input type="checkbox" name="includeAuthor" defaultChecked={initialFilters.includeAuthor} />
            {t("includeAuthor")}
          </label>
          <label>
            <input type="checkbox" name="includeExtDl" defaultChecked={initialFilters.includeExtDl} />
            {t("includeExtDl")}
          </label>
        </fieldset>
      </details>
    </form>
  );
};

export default PlainProjectSearchBar;
