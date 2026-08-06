"use client";

import { useMemo, useState } from "react";
import { compactMcVersions, toStringArray } from "@/lib/utils/format";
import { normalizeReleaseChannel } from "@/lib/releaseChannels";
import { useTableSort } from "@/lib/hooks/useTableSort";
import type { ProjectVersionsTableProps } from "./ProjectVersionsTable";

export type ParsedProjectVersion = ProjectVersionsTableProps["versions"][number] & {
  releaseChannel:   string;
  date:             Date;
  parsedLoaders:    string[];
  parsedMcVersions: string[];
};

const collectOptions = (rows: ParsedProjectVersion[], pick: (v: ParsedProjectVersion) => string[]): string[] => {
  const set = new Set<string>();
  rows.forEach((v) => pick(v).forEach((item) => set.add(item)));
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};

/**
 * 公開バージョン一覧のパース・絞り込み(チャンネル/ローダー/MC)・並び替えをまとめた共通フック。
 */
export function useProjectVersions(versions: ProjectVersionsTableProps["versions"]) {
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterLoader, setFilterLoader] = useState("all");
  const [filterMc, setFilterMc] = useState("all");

  const parsedVersions = useMemo<ParsedProjectVersion[]>(() => {
    return versions.map((version) => ({
      ...version,
      releaseChannel: normalizeReleaseChannel(version.releaseChannel),
      date: new Date(typeof version.createdAt === "number" ? version.createdAt * 1000 : version.createdAt),
      parsedLoaders: toStringArray(version.loaders),
      parsedMcVersions: compactMcVersions(toStringArray(version.mcVersions)),
    }));
  }, [versions]);

  const loaderOptions = useMemo(() => collectOptions(parsedVersions, (v) => v.parsedLoaders), [parsedVersions]);
  const mcOptions = useMemo(() => collectOptions(parsedVersions, (v) => v.parsedMcVersions), [parsedVersions]);

  const filteredVersions = useMemo(() => {
    return parsedVersions.filter((v) => {
      if (filterChannel !== "all" && v.releaseChannel !== filterChannel) return false;
      if (filterLoader !== "all" && !v.parsedLoaders.includes(filterLoader)) return false;
      if (filterMc !== "all" && !v.parsedMcVersions.includes(filterMc)) return false;
      return true;
    });
  }, [parsedVersions, filterChannel, filterLoader, filterMc]);

  const { sorted, order, orderBy, handleSort } = useTableSort<ParsedProjectVersion, "version" | "downloads" | "date">(filteredVersions, {
    version: (v) => v.versionNumber,
    downloads: (v) => v.downloads,
    date: (v) => v.date,
  }, { orderBy: "date", order: "desc" });

  return {
    versions: sorted,
    order,
    orderBy,
    handleSort,
    loaderOptions,
    mcOptions,
    filterChannel,
    setFilterChannel,
    filterLoader,
    setFilterLoader,
    filterMc,
    setFilterMc,
  };
}
