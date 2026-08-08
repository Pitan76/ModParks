import Box from "@mui/material/Box";
import type { ReactNode } from "react";

/** カード1枚が読みやすさを保てる最小幅(px)。これを下回るなら列を減らす */
const CARD_MIN_WIDTH = 280;
/** 画面がいくら広くてもこれ以上は列を増やさない */
const MAX_COLUMNS = 3;
/** MUI spacing の 1 単位 = 8px */
const SPACING_UNIT = 8;

export type CardGridProps = {
  children: ReactNode;
  /** カード間の余白 (MUI spacing 単位) */
  gap: number;
};

/**
 * プロジェクトカードを並べる可変列グリッド。
 * ビューポート幅ではなく実際のコンテンツ領域の幅で列数が決まるため、
 * 左のナビゲーションサイドバーを閉じた分もそのまま列数に反映される。
 */
const CardGrid = ({ children, gap }: CardGridProps) => {
  const gapsWidth = gap * SPACING_UNIT * (MAX_COLUMNS - 1);
  // 広いときは MAX_COLUMNS 等分、狭いときは CARD_MIN_WIDTH が下限として効く
  const columnWidth = `min(100%, max(${CARD_MIN_WIDTH}px, (100% - ${gapsWidth}px) / ${MAX_COLUMNS}))`;

  return (
    <Box
      sx={{
        display:             "grid",
        gap,
        gridTemplateColumns: `repeat(auto-fill, minmax(${columnWidth}, 1fr))`,
      }}
    >
      {children}
    </Box>
  );
};

export default CardGrid;
