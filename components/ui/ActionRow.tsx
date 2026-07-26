import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

export type ActionRowProps = {
  children: ReactNode;
  /** sm以上での縦位置揃え（デフォルト: flex-start） */
  align?: "flex-start" | "center" | "flex-end" | "stretch";
  /** 子要素間の間隔（theme spacing 単位。デフォルト: 2） */
  gap?: number;
  /** sm以上でも横に入りきらない場合に折り返しを許可する（要素数が多い行向け。デフォルト: false） */
  wrap?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * ボタン・入力欄などのアクション行を「余裕があれば横1行・無ければ縦全幅」で並べるコンテナ。
 *
 * スマホ幅(xs)では各子要素を全幅で縦積みし、中途半端な折り返し（2段/3段化・右端の不揃い）を防ぐ。
 * sm以上では横1行に並べ、子要素自身の flex 指定（例: sx={{ flex: "1 1 200px" }}）を尊重する。
 * 要素数が多く sm でも収まらない場合は wrap を有効化する。
 */
export default function ActionRow({ children, align = "flex-start", gap = 2, wrap = false, sx }: ActionRowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: align },
        flexWrap: { xs: "nowrap", sm: wrap ? "wrap" : "nowrap" },
        gap,
        // xsでは全子要素を全幅で縦積み。sm以上は各子要素自身のサイズ/flex指定を尊重する。
        "& > *": { width: { xs: "100%", sm: "auto" } },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
