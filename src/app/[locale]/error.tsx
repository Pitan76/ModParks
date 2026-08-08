"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * エラーバウンダリ (エラーを検知したら, ウェブ上に表示する)
 * @param error エラーオブジェクト
 * @param reset リセット関数
 * @returns エラーバウンダリコンポーネント
 */
const ErrorBoundary = ({ error, reset }: ErrorBoundaryProps) => {
  const t = useTranslations("Common");

  useEffect(() => {
    console.error("Route error:", error);

    // ChunkLoadError（チャンクのロード失敗）を検知した場合は自動でリロードして最新版を試みる
    if (error && (error.name === "ChunkLoadError" || (error.message && error.message.indexOf("Loading chunk") !== -1))) {
      const now = Date.now();
      const lastReload = sessionStorage.getItem("chunk_error_reload");
      // 10秒以内の連続リロードを防ぎ、無限ループを回避する
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem("chunk_error_reload", now.toString());
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "red" }}>{t("errorPage.title")}</h2>
      <p>{t("errorPage.description")}</p>
      <pre style={{ background: "#eee", padding: "20px", overflowX: "auto", color: "black", whiteSpace: "pre-wrap" }}>
        {error.name}: {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button onClick={() => reset()} style={{ padding: "10px 20px", marginTop: "20px", cursor: "pointer" }}>{t("retry")}</button>
    </div>
  );
};

export default ErrorBoundary;
