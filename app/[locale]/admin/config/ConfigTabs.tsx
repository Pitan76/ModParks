"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useTranslations } from "next-intl";

export default function ConfigTabs({
  appSettings,
  workerVars,
  secrets,
  taxonomy,
  ddos,
  reward,
}: {
  appSettings: ReactNode;
  workerVars: ReactNode;
  secrets: ReactNode;
  taxonomy: ReactNode;
  ddos: ReactNode;
  reward: ReactNode;
}) {
  const t = useTranslations("Admin.config");
  const [tab, setTab] = useState(0);

  const panels = [appSettings, workerVars, secrets, taxonomy, ddos, reward];

  return (
    <Box sx={{ width: "100%", overflow: "hidden" }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          mb: 3,
          maxWidth: "100%",
          "& .MuiTab-root": { whiteSpace: "nowrap", flexShrink: 0 },
        }}
      >
        <Tab label={t("appSettings")} />
        <Tab label={t("workerVars")} />
        <Tab label={t("secrets")} />
        <Tab label={t("tagsManagement")} />
        <Tab label={t("ddosDefense")} />
        <Tab label={t("rewardSettingsTitle")} />
      </Tabs>
      {panels.map((panel, i) => (
        <Box key={i} hidden={tab !== i}>
          {tab === i && panel}
        </Box>
      ))}
    </Box>
  );
}
