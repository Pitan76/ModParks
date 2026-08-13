"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { formatBytes } from "@/lib/utils/format";
import { buildVersionDownloadUrl } from "@/lib/utils/downloadUrl";
import type { ParsedProjectVersion } from "@/components/project/useProjectVersions";
import styles from "../plain.module.css";

export type PlainProjectVersionsTableProps = {
  versions: ParsedProjectVersion[];
  projectSlug: string;
  filterChannel: string;
  onChannelChange: (value: string) => void;
  filterLoader: string;
  onLoaderChange: (value: string) => void;
  filterMc: string;
  onMcChange: (value: string) => void;
  loaderOptions: string[];
  mcOptions: string[];
};

const CHANNELS = ["release", "beta", "alpha"] as const;

/**
 * Plain Theme 用のバージョン一覧。
 * 絞り込みは標準の select、一覧は素の table で表示し、並び替えUIとコンテキストメニューは持たない。
 */
const PlainProjectVersionsTable = ({
  versions,
  projectSlug,
  filterChannel,
  onChannelChange,
  filterLoader,
  onLoaderChange,
  filterMc,
  onMcChange,
  loaderOptions,
  mcOptions,
}: PlainProjectVersionsTableProps) => {
  const t = useTranslations("Project");
  const tVersion = useTranslations("Version");
  const format = useFormatter();

  return (
    <div>
      <p className={styles.searchRow}>
        <label>
          {t("table.filters.channel")}:{" "}
          <select value={filterChannel} onChange={(e) => onChannelChange(e.target.value)}>
            <option value="all">{t("table.filters.all")}</option>
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>{tVersion(`channels.${channel}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t("table.filters.loader")}:{" "}
          <select value={filterLoader} onChange={(e) => onLoaderChange(e.target.value)}>
            <option value="all">{t("table.filters.all")}</option>
            {loaderOptions.map((loader) => (
              <option key={loader} value={loader}>{loader}</option>
            ))}
          </select>
        </label>
        <label>
          {t("table.filters.mc")}:{" "}
          <select value={filterMc} onChange={(e) => onMcChange(e.target.value)}>
            <option value="all">{t("table.filters.all")}</option>
            {mcOptions.map((mc) => (
              <option key={mc} value={mc}>{mc}</option>
            ))}
          </select>
        </label>
      </p>

      {versions.length === 0 ? (
        <p className={styles.dim}>{t("table.noVersionsInChannel")}</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t("table.version")}</th>
                <th scope="col">{t("table.platformMcVersion")}</th>
                <th scope="col" className={styles.numeric}>{t("downloads")}</th>
                <th scope="col">{t("createdAt")}</th>
                <th scope="col">{t("download")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>
                    <Link href={`/projects/${projectSlug}/versions/${version.id}`} prefetch={false}>
                      {version.versionNumber}
                    </Link>{" "}
                    <span className={styles.dim}>{tVersion(`channels.${version.releaseChannel}`)}</span>
                  </td>
                  <td>
                    {version.parsedLoaders.join(", ")}
                    {version.parsedMcVersions.length > 0 && ` / ${version.parsedMcVersions.join(", ")}`}
                  </td>
                  <td className={styles.numeric}>
                    {version.downloads}
                    {version.fileSize !== null && <span className={styles.dim}> ({formatBytes(version.fileSize)})</span>}
                  </td>
                  <td>
                    <time dateTime={version.date.toISOString()}>
                      {format.dateTime(version.date, { dateStyle: "short" })}
                    </time>
                  </td>
                  <td>
                    <a href={buildVersionDownloadUrl(version.id)} download>
                      {t("download")}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlainProjectVersionsTable;
