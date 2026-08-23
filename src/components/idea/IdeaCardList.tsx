"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import { useColorMode } from "@/components/ThemeRegistry";
import IdeaCard, { IdeaCardData } from "./IdeaCard";

interface IdeaCardListProps {
  ideas: IdeaCardData[];
  /** 一覧の上に出す情報（件数など） */
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  /** 0件のときに出す内容 */
  emptyContent?: ReactNode;
  /** 一覧の下に出す内容（ページネーションなど） */
  footer?: ReactNode;
}

/**
 * アイデアカードの一覧。プロジェクト一覧と同じ枠組み（ヘッダー・空表示・フッター）を持つ。
 *
 * 表示形式の切り替えは持たない。アイデアカードは本文の抜粋を読ませる作りで、
 * グリッドに並べると情報が落ちるだけになるため。
 */
export default function IdeaCardList({ ideas, headerLeft, headerRight, emptyContent, footer }: IdeaCardListProps) {
  const { isNewTheme } = useColorMode();

  if (ideas.length === 0) return <>{emptyContent}</>;

  return (
    <Box>
      {(headerLeft || headerRight) && (
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>{headerLeft}</Box>
          <Box sx={{ flexShrink: 0 }}>{headerRight}</Box>
        </Box>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: isNewTheme ? 0 : 2 }}>
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} />
        ))}
      </Box>

      {footer}
    </Box>
  );
}
