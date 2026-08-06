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
