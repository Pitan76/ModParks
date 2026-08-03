"use client";

import { ReactElement } from "react";
import Tooltip from "@mui/material/Tooltip";
import { useFormatter } from "next-intl";

export interface DateTimeTooltipProps {
  date: Date | number | string;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

/**
 * 日付表示にホバーすると、完全な日時（年月日 + 時刻）をツールチップで表示します。
 * ツールチップの中身は開いたときにのみ描画されるため、SSR とのハイドレーション差分は発生しません。
 */
export default function DateTimeTooltip({ date, children, placement = "top" }: DateTimeTooltipProps) {
  const format = useFormatter();
  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) return children;

  return (
    <Tooltip
      title={format.dateTime(dateObj, { dateStyle: "long", timeStyle: "medium" })}
      arrow
      placement={placement}
    >
      {children}
    </Tooltip>
  );
}
