"use client";

import { useState } from "react";

/** 1ページあたりの件数。サーバ側の取得件数と揃える */
export const AUDIT_PAGE_SIZE = 10;

type FetchPage<T> = (limit: number, offset: number) => Promise<{ logs: T[]; total: number }>;

/**
 * 監査ログ1種類分のページング状態。
 *
 * 設定変更・バックアップ・DDoS の3種は取得先が違うだけで挙動が同じなので、
 * 種類ごとに state と handler を書かず、この1つを使い回す。
 */
export function useAuditLogPage<T>(initial: { logs: T[]; total: number }, fetchPage: FetchPage<T>) {
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState(initial.logs);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);

  const onPageChange = async (_event: unknown, newPage: number) => {
    setPage(newPage);
    setLoading(true);
    try {
      const res = await fetchPage(AUDIT_PAGE_SIZE, (newPage - 1) * AUDIT_PAGE_SIZE);
      setLogs(res.logs);
      setTotal(res.total);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return { page, logs, total, loading, onPageChange };
}

export type AuditLogPage<T> = ReturnType<typeof useAuditLogPage<T>>;
