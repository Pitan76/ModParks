"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useTranslations } from "next-intl";

interface ProjectFormTabsProps {
  basicContent: ReactNode;
  descriptionContent: ReactNode;
}

/**
 * 編集フォームを「基本情報」と「説明」に分ける。
 *
 * 非表示のタブもアンマウントせず display で切り替える。入力欄はフォームの
 * 送信対象なので、外すと表示していないタブの値が送られなくなるため。
 */
export default function ProjectFormTabs({ basicContent, descriptionContent }: ProjectFormTabsProps) {
  const t = useTranslations("Project.editTabs");
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={(_, next: number) => setTab(next)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 3 }}
      >
        <Tab label={t("info")} />
        <Tab label={t("description")} />
      </Tabs>

      <Box sx={{ display: tab === 0 ? "flex" : "none", flexDirection: "column", gap: 3 }}>
        {basicContent}
      </Box>
      <Box sx={{ display: tab === 1 ? "flex" : "none", flexDirection: "column", gap: 3 }}>
        {descriptionContent}
      </Box>
    </Box>
  );
}
