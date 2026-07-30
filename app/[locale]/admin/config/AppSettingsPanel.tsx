"use client";

import type { AppSettings } from "@/lib/config/appSettings";
import AppSettingsGroupPanel from "./AppSettingsGroupPanel";

export default function AppSettingsPanel({ initialSettings }: { initialSettings: AppSettings }) {
  return (
    <AppSettingsGroupPanel
      initialSettings={initialSettings}
      group="general"
      titleKey="appSettings"
      descKey="appSettingsDesc"
    />
  );
}
