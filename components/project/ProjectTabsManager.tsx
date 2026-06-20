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
  manageHref: string;
  canEdit: boolean;
  issueTrackerUrl?: string | null;
}

export default function ProjectTabsManager({ descriptionContent, filesContent, dependenciesContent, manageHref, canEdit, issueTrackerUrl }: ProjectTabsManagerProps) {
  const t = useTranslations("Project");
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const tabParam = searchParams?.get("tab") || null;
  
  const getTabFromParam = (param: string | null) => {
    if (param === "files") return 1;
    if (param === "dependencies") return 2;
    return 0;
  };

  const [tab, setTab] = useState(getTabFromParam(tabParam));

  useEffect(() => {
    setTab(getTabFromParam(tabParam));
  }, [tabParam]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    if (newValue === 3) {
      router.push(manageHref);
      return;
    }

    if (newValue === 4) {
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
            '& .MuiTab-root': {
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }
          }}
        >
          <Tab label={t("tabs.description")} value={0} />
          <Tab label={t("tabs.files")} value={1} />
          <Tab label={t("tabs.dependencies")} value={2} />
          {issueTrackerUrl && (
            <Tab 
              label={t("tabs.issues")}
              value={4}
              icon={<OpenInNewIcon sx={{ fontSize: '1rem', ml: 0.5 }} />}
              iconPosition="end"
            />
          )}
          {canEdit && (
            <Tab 
              label={t("tabs.manage")} 
              value={3}
            />
          )}
        </Tabs>
      </Box>

      {tab === 0 && <Box>{descriptionContent}</Box>}
      
      {tab === 1 && <Box>{filesContent}</Box>}
      
      {tab === 2 && <Box>{dependenciesContent}</Box>}
    </Box>
  );
}
