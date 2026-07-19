"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useRouter } from "@/i18n/routing";
import { useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface ProjectTabsManagerProps {
  descriptionContent: React.ReactNode;
  filesContent: React.ReactNode;
  dependenciesContent: React.ReactNode;
  recipesContent?: React.ReactNode;
  manageHref: string;
  canEdit: boolean;
  recipesEnabled?: boolean;
  issueTrackerUrl?: string | null;
}

export default function ProjectTabsManager({ descriptionContent, filesContent, dependenciesContent, recipesContent, manageHref, canEdit, recipesEnabled, issueTrackerUrl }: ProjectTabsManagerProps) {
  const t = useTranslations("Project");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const tabParam = searchParams?.get("tab") || null;
  
  const getTabFromParam = (param: string | null) => {
    if (param === "files") return 1;
    if (param === "dependencies") return 2;
    if (param === "recipes" && recipesEnabled) return 3;
    return 0;
  };

  const [tab, setTab] = useState(getTabFromParam(tabParam));

  useEffect(() => {
    setTab(getTabFromParam(tabParam));
  }, [tabParam]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (newValue === 4) {
      router.push(manageHref);
      return;
    }

    if (newValue === 5) {
      if (issueTrackerUrl) {
        window.open(issueTrackerUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }
    
    setTab(newValue);

    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newValue === 1) {
      params.set("tab", "files");
    } else if (newValue === 2) {
      params.set("tab", "dependencies");
    } else if (newValue === 3) {
      params.set("tab", "recipes");
    } else {
      params.delete("tab");
    }
    
    const newQuery = params.toString();
    const newUrl = newQuery ? `?${newQuery}` : pathname;
    
    // URLを更新するが、ページ全体のリロードやスクロールを発生させない
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
          <Tab label={t("tabs.description")} value={0} />
          <Tab label={t("tabs.files")} value={1} />
          <Tab label={t("tabs.dependencies")} value={2} />
          {recipesEnabled && <Tab label={t("tabs.recipes", "レシピ")} value={3} />}
          {issueTrackerUrl && (
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {t("tabs.issues")}
                  <OpenInNewIcon sx={{ fontSize: '1rem' }} />
                </Box>
              }
              value={5}
            />
          )}
          {canEdit && (
            <Tab 
              label={t("tabs.manage")} 
              value={4}
            />
          )}
        </Tabs>
      </Box>

      {/* 全タブを常時マウントし表示だけ切替。データはサーバー取得済みのため
          再取得は発生せず、初回オープンのラグも無くなる */}
      <Box sx={{ display: tab === 0 ? "block" : "none" }}>{descriptionContent}</Box>
      <Box sx={{ display: tab === 1 ? "block" : "none" }}>{filesContent}</Box>
      <Box sx={{ display: tab === 2 ? "block" : "none" }}>{dependenciesContent}</Box>
      {recipesEnabled && <Box sx={{ display: tab === 3 ? "block" : "none" }}>{recipesContent}</Box>}
    </Box>
  );
}
