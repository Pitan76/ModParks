"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useTranslations } from "next-intl";

/** 直前のバージョンから引き継げる設定値 */
export type PreviousVersionSettings = {
  versionNumber: string;
  mcVersions: string[];
  loaders: string[];
  releaseChannel: string;
};

export type PreviousVersionSettingsBannerProps = {
  settings: PreviousVersionSettings;
  /** 既に流用済みかどうか（ボタンを無効化するために使う） */
  applied: boolean;
  onApply: () => void;
};

/**
 * 直前のバージョンの対応MCバージョン・ローダー・リリースチャネルを
 * ワンクリックで新バージョンへ流用するための案内。
 */
const PreviousVersionSettingsBanner = ({ settings, applied, onApply }: PreviousVersionSettingsBannerProps) => {
  const tVersion = useTranslations("Version");
  const summary = [...settings.mcVersions, ...settings.loaders];

  return (
    <Alert
      severity="info"
      action={
        <Button size="small" onClick={onApply} disabled={applied}>
          {applied ? tVersion("uploadForm.reuseApplied") : tVersion("uploadForm.reuseApply")}
        </Button>
      }
    >
      {tVersion("uploadForm.reusePrevious", { version: settings.versionNumber })}
      {summary.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
          {summary.map((label) => (
            <Chip key={label} label={label} size="small" variant="outlined" />
          ))}
        </Box>
      )}
    </Alert>
  );
};

export default PreviousVersionSettingsBanner;
