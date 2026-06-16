"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Typography from "@mui/material/Typography";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface ProjectTabsManagerProps {
  descriptionContent: React.ReactNode;
  filesContent: React.ReactNode;
  manageHref: string;
  canEdit: boolean;
}

export default function ProjectTabsManager({ descriptionContent, filesContent, manageHref, canEdit }: ProjectTabsManagerProps) {
  const t = useTranslations("Project");
  const router = useRouter();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3, maxWidth: "100%" }}>
        <Tabs 
          value={tab} 
          onChange={(e, newValue) => {
            // Tab 3 is Manage, which redirects
            if (newValue === 3) {
              router.push(manageHref);
            } else {
              setTab(newValue);
            }
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={t("tabs.description")} value={0} />
          <Tab label={t("tabs.files")} value={1} />
          <Tab label={t("tabs.dependencies")} value={2} />
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
      
      {tab === 2 && (
        <Box sx={{ p: 6, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, border: "1px dashed", borderColor: "divider" }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t("tabs.underConstruction")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("tabs.dependenciesDesc")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
