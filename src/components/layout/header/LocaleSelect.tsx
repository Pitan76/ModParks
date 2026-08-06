"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import LanguageIcon from "@mui/icons-material/Language";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { LOCALE_OPTIONS } from "@/lib/i18n/localeLabels";
import type { AppLocale } from "@/lib/i18n/routing";

/** ヘッダーの言語切替。ログイン時は設定画面から変更するため、未ログイン時のみ表示される */
const LocaleSelect = () => {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Tooltip title="Language">
      <Select
        id="locale-select"
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as AppLocale })}
        size="small"
        variant="outlined"
        renderValue={(v) => (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <LanguageIcon fontSize="small" />
            <Typography variant="body2" sx={{ mt: "1px" }}>{v.toUpperCase()}</Typography>
          </Box>
        )}
        sx={{
          display: { xs: "none", md: "flex" },
          color:        "text.secondary",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "divider" },
          ".MuiSelect-icon": { color: "text.secondary" },
        }}
      >
        {LOCALE_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
        ))}
      </Select>
    </Tooltip>
  );
};

export default LocaleSelect;
