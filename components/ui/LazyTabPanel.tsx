"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

export type LazyTabPanelProps = {
  /** このパネルが現在選択中かどうか */
  active: boolean;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/**
 * タブの中身を「一度開くまでマウントしない、一度開いたらアンマウントしない」で描画するパネル。
 *
 * 全タブを常時マウントすると初回ハイドレーションに全タブ分のコストが乗ってページを開いた直後が固まり、
 * 逆に切り替えのたびにアンマウントすると再訪のたびに再取得・再描画が走る。このコンポーネントはその
 * 中間を取り、初回コストは開いたタブの分だけ、2回目以降の切り替えは display の変更だけで済ませる。
 *
 * 訪問済みかどうかは各パネルが自分で持つため、呼び出し側はタブの状態管理をするだけでよい。
 */
const LazyTabPanel = ({ active, children, sx }: LazyTabPanelProps) => {
  // 選択された瞬間の描画でそのまま中身を出したいので、effect ではなく描画中に更新する。
  // effect でマウントを許可すると、中身が出るまでに再描画が 1 回余計に挟まる。
  const [everActive, setEverActive] = useState(active);
  if (active && !everActive) setEverActive(true);

  if (!everActive) return null;

  return (
    <Box role="tabpanel" hidden={!active} sx={{ display: active ? "block" : "none", ...sx }}>
      {children}
    </Box>
  );
};

export default LazyTabPanel;
