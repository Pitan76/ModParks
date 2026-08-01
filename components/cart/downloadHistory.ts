import { useSyncExternalStore } from "react";
import type { CartItem } from "./cartStore";

export interface DownloadHistoryEntry extends CartItem {
  /** ダウンロードした時刻（epoch ms） */
  downloadedAt: number;
  /** ダウンロード時に指定していた絞り込み条件。未指定なら undefined */
  loader?: string;
  mcVersion?: string;
}

const STORAGE_KEY = "modparks_download_history";
/** 際限なく増えると localStorage を圧迫するため、新しいものから一定件数だけ保持する */
const MAX_ENTRIES = 100;

let entries: DownloadHistoryEntry[] = [];
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) entries = JSON.parse(stored);
  } catch (e) {
    console.error(e);
  }
}

const listeners = new Set<() => void>();

export const downloadHistoryStore = {
  getSnapshot: () => entries,
  getServerSnapshot: () => [] as DownloadHistoryEntry[],
  /**
   * ダウンロードを記録する。同じプロジェクトの古い記録は取り除いて先頭に積み直す。
   */
  record: (items: CartItem[], meta?: { loader?: string; mcVersion?: string }) => {
    if (items.length === 0) return;
    const now = Date.now();
    const fresh: DownloadHistoryEntry[] = items.map((item) => ({
      ...item,
      downloadedAt: now,
      loader: meta?.loader || undefined,
      mcVersion: meta?.mcVersion || undefined,
    }));
    const freshIds = new Set(fresh.map((e) => e.id));
    entries = [...fresh, ...entries.filter((e) => !freshIds.has(e.id))].slice(0, MAX_ENTRIES);
    downloadHistoryStore._notify();
  },
  remove: (id: string) => {
    entries = entries.filter((e) => e.id !== id);
    downloadHistoryStore._notify();
  },
  clear: () => {
    entries = [];
    downloadHistoryStore._notify();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  _notify: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch (e) {
        console.error(e);
      }
    }
    listeners.forEach((l) => l());
  },
};

export function useDownloadHistory() {
  const items = useSyncExternalStore(
    downloadHistoryStore.subscribe,
    downloadHistoryStore.getSnapshot,
    downloadHistoryStore.getServerSnapshot
  );

  return {
    items,
    record: downloadHistoryStore.record,
    remove: downloadHistoryStore.remove,
    clear: downloadHistoryStore.clear,
  };
}
