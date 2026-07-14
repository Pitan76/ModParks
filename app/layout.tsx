// ルートレイアウト
// 実際のレイアウトは app/[locale]/layout.tsx で定義

import { ReactNode } from "react";

const RootLayout = ({ children }: { children: ReactNode }) => {
  return children;
};

export default RootLayout;
