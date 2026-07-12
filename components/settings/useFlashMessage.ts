import { useState, useCallback } from "react";

export type FlashMessage = { type: "success" | "error"; text: string } | null;

/**
 * 一定時間後に自動で消えるフィードバックメッセージを扱う共通フック。
 * 設定画面の各タブで重複していた setTimeout 処理を集約する。
 */
export function useFlashMessage(timeout = 3000) {
  const [message, setMessage] = useState<FlashMessage>(null);

  const flash = useCallback(
    (type: "success" | "error", text: string) => {
      setMessage({ type, text });
      setTimeout(() => setMessage(null), timeout);
    },
    [timeout]
  );

  return { message, flash, setMessage };
}
