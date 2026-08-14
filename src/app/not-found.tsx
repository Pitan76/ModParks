import Link from "next/link";

/**
 * ロケールなし・ロケール不整合時にNext.jsが自動的に呼び出すルートの404フォールバックページ。
 * 最小限のHTMLとインラインスタイルで定義。
 */
export default function NotFound() {
  return (
    <html lang="ja">
      <body style={{ fontFamily: "sans-serif", margin: 0, padding: "50px", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", backgroundColor: "#121212", color: "#ffffff" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "3rem", margin: "0 0 20px 0", color: "#2563eb" }}>404 - Page Not Found</h1>
          <p style={{ color: "#a3a3a3", marginBottom: "30px" }}>
            お探しのページが見つかりません。 / The page you are looking for could not be found.
          </p>
          <p>
            <Link href="/ja" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>
              トップページに戻る / Go to Homepage
            </Link>
          </p>
        </div>
      </body>
    </html>
  );
}
