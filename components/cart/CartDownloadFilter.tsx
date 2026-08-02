"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";
import { LOADERS_DATA } from "@/lib/data/loaderIds";
import { MC_VERSIONS } from "@/lib/data/minecraftVersions";

export interface CartDownloadFilterProps {
  loader: string;
  mcVersion: string;
  onLoaderChange: (loader: string) => void;
  onMcVersionChange: (mcVersion: string) => void;
}

// テーマ既定の disablePortal だとドロワー内に埋め込まれて表示位置が崩れる
const SELECT_SLOT_PROPS = {
  select: { MenuProps: { disablePortal: false, slotProps: { paper: { sx: { maxHeight: 320 } } } } },
} as const;

/**
 * 一括ダウンロード対象を絞り込むセレクタ。
 * 空文字は「指定なし」を意味し、条件に合うバージョンが無い場合はサーバ側が最新版へフォールバックする。
 */
export default function CartDownloadFilter({
  loader,
  mcVersion,
  onLoaderChange,
  onMcVersionChange,
}: CartDownloadFilterProps) {
  const t = useTranslations("Cart");

  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
      <TextField
        select
        size="small"
        fullWidth
        label={t("loader")}
        value={loader}
        onChange={(e) => onLoaderChange(e.target.value)}
        slotProps={SELECT_SLOT_PROPS}
      >
        <MenuItem value="">{t("anyFilter")}</MenuItem>
        {LOADERS_DATA.map((l) => (
          <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
        ))}
      </TextField>
      <TextField
        select
        size="small"
        fullWidth
        label={t("mcVersion")}
        value={mcVersion}
        onChange={(e) => onMcVersionChange(e.target.value)}
        slotProps={SELECT_SLOT_PROPS}
      >
        <MenuItem value="">{t("anyFilter")}</MenuItem>
        {MC_VERSIONS.map((v) => (
          <MenuItem key={v} value={v}>{v}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
