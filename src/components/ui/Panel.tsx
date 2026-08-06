import Box from "@mui/material/Box";
import type { BoxProps } from "@mui/material/Box";

export type PanelProps = BoxProps & {
  /**
   * 内側の余白（theme spacing 単位）。未指定なら余白なし。
   * 数値を渡すとモバイル(xs)は 0・sm以上でその値になる。
   * `[xs, sm]` で個別指定も可能。
   */
  pad?: number | [number, number];
};

/**
 * フォームやテーブルを配置するための、枠を持たない最小限のセクション。
 *
 * MUI Card の「枠線＋影＋40px余白」を単なる箱として乱用していた箇所の置き換え用。
 * ページ側の Container が既に左右余白を与えるため、枠・背景・既定の余白は持たない
 * （＝二重カード・モバイルでの余白の無駄を避ける）。余白が要る箇所だけ pad を指定する。
 */
export default function Panel({ children, pad, sx, ...props }: PanelProps) {
  const [padXs, padSm] = Array.isArray(pad) ? pad : [0, pad ?? 0];
  return (
    <Box sx={{ p: { xs: padXs, sm: padSm }, ...sx }} {...props}>
      {children}
    </Box>
  );
}
