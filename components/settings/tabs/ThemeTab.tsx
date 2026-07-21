"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Alert from "@mui/material/Alert";
import { useColorMode } from "@/components/ThemeRegistry";

/**
 * テーマ設定タブコンポーネント。
 * デフォルトの新しいテーマと、以前のUI（レガシーテーマ）を切り替えることができます。
 */
export default function ThemeTab() {
  const t = useTranslations("Settings.theme");
  const { isNewTheme, setThemeType } = useColorMode();
  const [selectedTheme, setSelectedTheme] = useState<"new" | "legacy">(
    isNewTheme ? "new" : "legacy"
  );
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    setThemeType(selectedTheme);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 500 }}>
      {success && <Alert severity="success">{t("success")}</Alert>}

      <FormControl>
        <FormLabel id="theme-select-label" sx={{ mb: 1, fontWeight: 600 }}>
          {t("label")}
        </FormLabel>
        <RadioGroup
          aria-labelledby="theme-select-label"
          value={selectedTheme}
          onChange={(e) => setSelectedTheme(e.target.value as "new" | "legacy")}
        >
          <FormControlLabel
            value="new"
            control={<Radio />}
            label={t("newTheme")}
          />
          <FormControlLabel
            value="legacy"
            control={<Radio />}
            label={t("legacyTheme")}
          />
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 1 }}>
        <Button variant="contained" onClick={handleSave}>
          {t("save")}
        </Button>
      </Box>
    </Box>
  );
}
