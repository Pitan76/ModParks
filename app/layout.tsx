// ルートレイアウト — next-intl のロケールルーティングのために最小限に保つ
// 実際のレイアウトは app/[locale]/layout.tsx で定義

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
