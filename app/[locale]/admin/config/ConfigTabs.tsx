"use client";

import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useTranslations } from "next-intl";

export default function ConfigTabs({
  appSettings,
  workerVars,
  taxonomy,
}: {
  appSettings: ReactNode;
  workerVars: ReactNode;
  taxonomy: ReactNode;
}) {
  const t = useTranslations("Admin.config");
  const [tab, setTab] = useState(0);

  const panels = [appSettings, workerVars, taxonomy];

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t("appSettings")} />
        <Tab label={t("workerVars")} />
        <Tab label={t("tagsManagement")} />
      </Tabs>
      {panels.map((panel, i) => (
        <Box key={i} hidden={tab !== i}>
          {tab === i && panel}
        </Box>
      ))}
    </Box>
  );
}
