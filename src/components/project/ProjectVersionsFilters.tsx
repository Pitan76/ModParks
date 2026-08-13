"use client";

import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";
import { getLoaderInfo } from "@/lib/loaders";

type Props = {
  filterChannel: string;
  onChannelChange: (value: string) => void;
  filterLoader: string;
  onLoaderChange: (value: string) => void;
  filterMc: string;
  onMcChange: (value: string) => void;
  loaderOptions: string[];
  mcOptions: string[];
};

/**
 * 公開バージョン一覧の絞り込みUI(チャンネルタブ + ローダー/MCバージョンの選択)。
 */
export default function ProjectVersionsFilters({
  filterChannel,
  onChannelChange,
  filterLoader,
  onLoaderChange,
  filterMc,
  onMcChange,
  loaderOptions,
  mcOptions,
}: Props) {
  const t = useTranslations("Project.table");
  const tVersion = useTranslations("Version");

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={filterChannel}
          onChange={(_, val) => onChannelChange(val)}
          aria-label={t("filters.channel")}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, py: 0 } }}
        >
          <Tab label={t("filters.all")} value="all" />
          <Tab label={tVersion("channels.release")} value="release" />
          <Tab label={tVersion("channels.beta")} value="beta" />
          <Tab label={tVersion("channels.alpha")} value="alpha" />
        </Tabs>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 1.5 }}>
        <TextField
          select
          size="small"
          label={t("filters.loader")}
          value={filterLoader}
          onChange={(e) => onLoaderChange(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">{t("filters.all")}</MenuItem>
          {loaderOptions.map((l) => (
            <MenuItem key={l} value={l}>{getLoaderInfo(l).name}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("filters.mc")}
          value={filterMc}
          onChange={(e) => onMcChange(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">{t("filters.all")}</MenuItem>
          {mcOptions.map((mc) => (
            <MenuItem key={mc} value={mc}>{mc}</MenuItem>
          ))}
        </TextField>
      </Stack>
    </Box>
  );
}
