"use client";

import { useState, useEffect } from "react";
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
  value?: number;
  onChange?: (newValue: number) => void;
}

export default function TabbedPanel({ items, defaultTab = 0, value, onChange }: TabbedPanelProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab);
  
  const isControlled = value !== undefined;
  const activeTab = isControlled ? value : internalActiveTab;

  const handleTabChange = (newValue: number) => {
    if (!isControlled) {
      setInternalActiveTab(newValue);
    }
    if (onChange) {
      onChange(newValue);
    }
  };

  // 隠されていないタブだけを抽出
  const visibleItems = items.filter(item => !item.hidden);

  // もし現在の activeTab がインデックス範囲外になっていたら調整
  const safeActiveTab = activeTab >= visibleItems.length ? 0 : activeTab;

  // 訪れたタブインデックスをキャッシュする状態
  const [visitedTabs, setVisitedTabs] = useState<Set<number>>(new Set([safeActiveTab]));

  // 現在表示されているタブを訪問済みに登録
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(safeActiveTab)) return prev;
      const next = new Set(prev);
      next.add(safeActiveTab);
      return next;
    });
  }, [safeActiveTab]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4, maxWidth: "100%" }}>
        <Tabs
          value={safeActiveTab}
          onChange={(_, newValue) => handleTabChange(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '100%' },
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

      {/* 訪れたタブのみを描画し、アクティブでなければ display: none で状態を維持する */}
      <Box>
        {visibleItems.map((item, index) => {
          const isVisited = visitedTabs.has(index);
          const isActive = index === safeActiveTab;

          if (!isVisited) return null;

          return (
            <Box key={index} sx={{ display: isActive ? "block" : "none" }}>
              {item.content}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
