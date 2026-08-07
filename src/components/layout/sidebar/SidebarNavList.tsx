"use client";

import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useContextMenuHandler, useCommonItems, useContextMenuContext } from "@/components/ui/ContextMenu";
import { useState, useEffect } from "react";
import { getIsSelected, type NavItem } from "./navTypes";

export type SidebarNavListProps = {
  navItems: NavItem[];
  onNavigate: (path: string) => void;
  /** カート等、ナビ項目の下に差し込む要素 */
  children?: React.ReactNode;
};

/** 選択状態の項目に敷く配色。親子で同じ見た目にするため共有する */
const selectedItemSx = {
  borderRadius: 1,
  "&.Mui-selected": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
    "&:hover": { bgcolor: "primary.dark" },
    "& .MuiListItemIcon-root": { color: "primary.contrastText" },
  },
} as const;

/**
 * サイドバーのナビゲーション一覧。
 * 単独項目と、開閉するグループ（children を持つ項目）の双方を描画する。
 */
const SidebarNavList = ({ navItems, onNavigate, children }: SidebarNavListProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMyProjects = searchParams?.get("author") === "me";
  const tMenu = useTranslations("ContextMenu");
  const openMenu = useContextMenuHandler();
  const { isDisabled } = useContextMenuContext();
  const c = useCommonItems();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 現在地を含むグループは開いた状態で見せる。利用者が閉じた分は畳まない（マージする）
  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if (!item.children) return;
      if (item.children.some((child) => child.path === pathname)) nextState[item.id] = true;
    });
    if (Object.keys(nextState).length > 0) {
      setOpenGroups((prev) => ({ ...prev, ...nextState }));
    }
  }, [pathname, navItems]);

  const toggleGroup = (groupId: string) =>
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));

  const navContextMenu = (path: string) => (e: React.MouseEvent) => {
    openMenu(e, [
      c.open(path, tMenu("open")),
      c.openNewTab(path),
      { type: "divider" },
      c.copyLink(path),
    ]);
  };

  /** 単独項目・グループの子項目に共通の行 */
  const renderLeaf = (item: Omit<NavItem, "children">) => {
    const isSelected = getIsSelected(item.id, item.path, pathname, isMyProjects);

    return (
      <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
        <ListItemButton
          onClick={() => onNavigate(item.path)}
          onContextMenu={navContextMenu(item.path)}
          selected={isSelected}
          sx={{ WebkitTouchCallout: isDisabled ? "default" : "none", ...selectedItemSx }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: pathname === item.path ? "inherit" : "text.secondary" }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={<Typography sx={{ fontWeight: isSelected ? 700 : 500 }}>{item.label}</Typography>}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const renderGroup = (item: NavItem, groupChildren: Omit<NavItem, "children">[]) => {
    const isOpen = !!openGroups[item.id];
    const hasActiveChild = groupChildren.some((child) => child.path === pathname);

    return (
      <Box key={item.id} sx={{ mb: 0.5 }}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => toggleGroup(item.id)}
            sx={{ borderRadius: 1, color: hasActiveChild ? "primary.main" : "text.primary" }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: hasActiveChild ? "primary.main" : "text.secondary" }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={<Typography sx={{ fontWeight: hasActiveChild ? 700 : 500 }}>{item.label}</Typography>}
            />
            {isOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding sx={{ pl: 2, mt: 0.5 }}>
            {groupChildren.map(renderLeaf)}
          </List>
        </Collapse>
      </Box>
    );
  };

  return (
    <List sx={{ px: 1, py: 2, flexGrow: 1, overflowY: "auto" }}>
      {navItems.map((item) => (item.children ? renderGroup(item, item.children) : renderLeaf(item)))}
      {children}
    </List>
  );
};

export default SidebarNavList;
