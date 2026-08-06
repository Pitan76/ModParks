"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    console.error("ローカルエラー:", error);
  }, [error]);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h2 style={{ color: "red" }}>エラーが発生しました!</h2>
      <p>問題が発生したため、ページを正常に読み込むことができませんでした</p>
      <pre style={{ background: "#eee", padding: "20px", overflowX: "auto", color: "black", whiteSpace: "pre-wrap" }}>
        {error.name}: {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button onClick={() => reset()} style={{ padding: "10px 20px", marginTop: "20px", cursor: "pointer" }}>再試行</button>
    </div>
  );
};

export default ErrorBoundary;
