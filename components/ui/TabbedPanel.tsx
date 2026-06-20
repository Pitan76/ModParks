"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

export interface TabbedPanelItem {
  label: React.ReactNode;
  content: React.ReactNode;
  hidden?: boolean;
}

export interface TabbedPanelProps {
  items: TabbedPanelItem[];
  defaultTab?: number;
}

export default function TabbedPanel({ items, defaultTab = 0 }: TabbedPanelProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // 隠されていないタブだけを抽出
  const visibleItems = items.filter(item => !item.hidden);

  if (visibleItems.length === 0) {
    return null;
  }

  // もし現在の activeTab がインデックス範囲外になっていたら調整
  const safeActiveTab = activeTab >= visibleItems.length ? 0 : activeTab;

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4, maxWidth: "100%" }}>
        <Tabs
          value={safeActiveTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons={true}
          allowScrollButtonsMobile
          sx={{
            maxWidth: '100%',
            '& .MuiTab-root': {
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }
          }}
        >
          {visibleItems.map((item, index) => (
            <Tab key={index} label={item.label} />
          ))}
        </Tabs>
      </Box>

      {/* 選択されたタブのコンテンツのみを描画 */}
      <Box>
        {visibleItems[safeActiveTab].content}
      </Box>
    </Box>
  );
}
