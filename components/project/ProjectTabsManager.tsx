"use client";

import { useState, useEffect } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRouter } from "@/i18n/routing";
import { useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export type ProjectTabsManagerProps = {
  descriptionContent: ReactNode;
  filesContent: ReactNode;
  dependenciesContent: ReactNode;
  recipesContent?: ReactNode;
  mediaContent?: ReactNode;
  manageHref: string;
  canEdit: boolean;
  recipesEnabled?: boolean;
  issueTrackerUrl?: string | null;
};

const TAB_DESCRIPTION = 0;
const TAB_FILES = 1;
const TAB_DEPENDENCIES = 2;
const TAB_RECIPES = 3;
const TAB_MEDIA = 4;
const TAB_MANAGE = 5;
const TAB_ISSUES = 6;

const getTabFromParam = (param: string | null, recipesEnabled?: boolean, mediaEnabled?: boolean): number => {
  if (param === "files") return TAB_FILES;
  if (param === "dependencies") return TAB_DEPENDENCIES;
  if (param === "recipes" && recipesEnabled) return TAB_RECIPES;
  if (param === "media" && mediaEnabled) return TAB_MEDIA;
  return TAB_DESCRIPTION;
};

/**
 * プロジェクト詳細ページの主要タブ（説明、ファイル一覧、依存関係、レシピ一覧、メディア一覧、管理機能、課題管理）の切り替えを管理するクライアントコンポーネント。
 */
const ProjectTabsManager = ({
  descriptionContent,
  filesContent,
  dependenciesContent,
  recipesContent,
  mediaContent,
  manageHref,
  canEdit,
  recipesEnabled,
  issueTrackerUrl,
}: ProjectTabsManagerProps) => {
  const t = useTranslations("Project");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const hasMedia = !!mediaContent;
  const tabParam = searchParams?.get("tab") || null;
  const [tab, setTab] = useState(getTabFromParam(tabParam, recipesEnabled, hasMedia));

  useEffect(() => {
    setTab(getTabFromParam(tabParam, recipesEnabled, hasMedia));
  }, [tabParam, recipesEnabled, hasMedia]);

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    if (newValue === TAB_MANAGE) {
      router.push(manageHref);
      return;
    }

    if (newValue === TAB_ISSUES) {
      if (issueTrackerUrl) {
        window.open(issueTrackerUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    
    setTab(newValue);

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newValue === TAB_FILES) params.set("tab", "files");
    else if (newValue === TAB_DEPENDENCIES) params.set("tab", "dependencies");
    else if (newValue === TAB_RECIPES) params.set("tab", "recipes");
    else if (newValue === TAB_MEDIA) params.set("tab", "media");
    else params.delete("tab");
    
    const newQuery = params.toString();
    const newUrl = newQuery ? `?${newQuery}` : pathname;
    
    window.history.replaceState(null, '', newUrl);
  };

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, maxWidth: "100%" }}>
        <Tabs 
          value={tab} 
          onChange={handleTabChange}
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
          <Tab label={t("tabs.description")} value={TAB_DESCRIPTION} />
          <Tab label={t("tabs.files")} value={TAB_FILES} />
          <Tab label={t("tabs.dependencies")} value={TAB_DEPENDENCIES} />
          {recipesEnabled && <Tab label={t("tabs.recipes")} value={TAB_RECIPES} />}
          {hasMedia && <Tab label={t("tabs.media")} value={TAB_MEDIA} />}
          {issueTrackerUrl && (
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {t("tabs.issues")}
                  <OpenInNewIcon sx={{ fontSize: '1rem' }} />
                </Box>
              }
              value={TAB_ISSUES}
            />
          )}
          {canEdit && (
            <Tab 
              label={t("tabs.manage")} 
              value={TAB_MANAGE}
            />
          )}
        </Tabs>
      </Box>

      {/* 全タブを常時マウントし表示だけ切替 */}
      <Box sx={{ display: tab === TAB_DESCRIPTION ? "block" : "none" }}>{descriptionContent}</Box>
      <Box sx={{ display: tab === TAB_FILES ? "block" : "none" }}>{filesContent}</Box>
      <Box sx={{ display: tab === TAB_DEPENDENCIES ? "block" : "none" }}>{dependenciesContent}</Box>
      {recipesEnabled && <Box sx={{ display: tab === TAB_RECIPES ? "block" : "none" }}>{recipesContent}</Box>}
      {hasMedia && <Box sx={{ display: tab === TAB_MEDIA ? "block" : "none" }}>{mediaContent}</Box>}
    </Box>
  );
};

export default ProjectTabsManager;
