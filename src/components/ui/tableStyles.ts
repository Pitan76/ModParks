import type { SxProps, Theme } from "@mui/material/styles";

/**
 * ダッシュボードの「プロジェクト一覧」テーブルを基準とした、
 * サイト全体で共通のテーブルデザイン。各テーブルで見た目を揃えるために使う。
 * satisfiesでオブジェクトリテラル型を保つことで、sxの配列記法にも渡せるようにしている。
 */

/** テーブルのコンテナ(Card/Paper): 角丸 + 列が潰れて縦書きになるのを防ぐ横スクロール */
export const tableContainerSx = {
  borderRadius: 3,
  width: "100%",
  maxWidth: "100%",
  overflowX: "auto",
} satisfies SxProps<Theme>;

/** ヘッダ行: 背景を敷き、全ヘッダセルを太字 + 折り返し禁止(縦書き防止) */
export const tableHeadSx = {
  bgcolor: "action.hover",
  "& .MuiTableCell-root": { fontWeight: "bold", whiteSpace: "nowrap" },
} satisfies SxProps<Theme>;

/** テーブル本体: 最終行の下線を消す。<Table>のsxに指定する */
export const tableRootSx = {
  "& tbody tr:last-child td, & tbody tr:last-child th": { border: 0 },
} satisfies SxProps<Theme>;

/** 列が潰れて文字が縦積みになるのを防ぐ最小幅の目安。<Table>のsxに使う */
export const TABLE_MIN_WIDTH = 640;
