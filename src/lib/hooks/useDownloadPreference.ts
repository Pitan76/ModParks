"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseCsvParam, type DownloadPreference } from "@/lib/utils/downloadUrl";

/**
 * 現在の検索条件（高度な検索・プラットフォーム絞り込み）を
 * ダウンロード対象バージョンの優先条件として取り出す。
 *
 * プロジェクトカードのコンテキストメニューや、将来追加しうる
 * カード上のダウンロードボタンから共通で使う想定。
 */
export const useDownloadPreference = (): DownloadPreference => {
  const searchParams = useSearchParams();
  const loaders = searchParams?.get("loaders") ?? null;
  const mcVersions = searchParams?.get("mcVersions") ?? null;

  return useMemo(
    () => ({ loaders: parseCsvParam(loaders), mcVersions: parseCsvParam(mcVersions) }),
    [loaders, mcVersions]
  );
};
