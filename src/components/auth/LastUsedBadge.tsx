"use client";

import Badge from "@mui/material/Badge";
import Tooltip from "@mui/material/Tooltip";
import HistoryIcon from "@mui/icons-material/History";
import { useTranslations } from "next-intl";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactElement } from "react";

export type LastUsedBadgeProps = {
  /** 前回のログインに使われた手段かどうか */
  active: boolean;
  /** バッジを重ねたときも元のボタンの並び方を保つためのスタイル */
  sx?: SxProps<Theme>;
  children: ReactElement;
};

/**
 * 「前回この方法でログインした」ことを示すバッジを、
 * ログインボタンの右上に重ねて表示する。
 */
const LastUsedBadge = ({ active, sx, children }: LastUsedBadgeProps) => {
  const tAuth = useTranslations("Auth");
  if (!active) return children;

  return (
    <Tooltip title={tAuth("login.lastUsed")}>
      <Badge
        color="primary"
        overlap="rectangular"
        badgeContent={<HistoryIcon sx={{ fontSize: 12 }} />}
        aria-label={tAuth("login.lastUsed")}
        sx={[
          { display: "flex", minWidth: 0, "& .MuiBadge-badge": { height: 18, minWidth: 18, p: 0 } },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {children}
      </Badge>
    </Tooltip>
  );
};

export default LastUsedBadge;
