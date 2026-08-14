"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import FormHelperText from "@mui/material/FormHelperText";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import { useColorMode } from "@/components/ThemeRegistry";
import { useContextMenuContext } from "@/components/ui/ContextMenu";
import { cartEnabledStore, useCartEnabled } from "@/components/cart/cartStore";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";
import type { ThemeType } from "@/lib/themeType";

/**
 * テーマ設定タブコンポーネント。
 * デフォルトの新しいテーマと、以前のUI（レガシーテーマ）を切り替えることができます。
 */
export default function ThemeTab() {
  const t = useTranslations("Settings.theme");
  const { themeType, setThemeType, mode, setColorMode } = useColorMode();
  const { setIsDisabled } = useContextMenuContext();
  const cartEnabled = useCartEnabled();
  const [success, setSuccess] = useState(false);

  const form = useDirtyForm(
    {
      selectedTheme: themeType,
      colorMode: mode as "light" | "dark",
      useCustomContextMenu: true,
      useCart: cartEnabled,
      showAiLabel: true,
    },
    (values) => {
      setThemeType(values.selectedTheme);
      setColorMode(values.colorMode);
      try {
        window.localStorage.setItem("disable_custom_context_menu", values.useCustomContextMenu ? "false" : "true");
        setIsDisabled(!values.useCustomContextMenu);
        window.localStorage.setItem("show_ai_label", values.showAiLabel ? "true" : "false");
      } catch (e) {
        // ignore
      }
      cartEnabledStore.set(values.useCart);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  );
  const { selectedTheme, colorMode, useCustomContextMenu, useCart, showAiLabel } = form.values;
  const commit = form.commit;

  // ローカルストレージ / カートストアの現在値を保存済みの初期値として取り込む
  useEffect(() => {
    let disabled = false;
    let showAi = true;
    try {
      disabled = window.localStorage.getItem("disable_custom_context_menu") === "true";
      showAi = window.localStorage.getItem("show_ai_label") !== "false";
    } catch (e) {
      // ignore
    }
    commit((prev) => ({ ...prev, useCustomContextMenu: !disabled, useCart: cartEnabled, colorMode: mode, selectedTheme: themeType, showAiLabel: showAi }));
  }, [cartEnabled, commit, mode, themeType]);

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
          onChange={(e) => form.setField("selectedTheme", e.target.value as ThemeType)}
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
          <FormControlLabel
            value="plain"
            control={<Radio />}
            label={t("plainTheme")}
          />
        </RadioGroup>
        <FormHelperText>{t("plainThemeDesc")}</FormHelperText>
      </FormControl>

      <FormControl>
        <FormLabel id="color-mode-select-label" sx={{ mb: 1, fontWeight: 600 }}>
          {t("colorModeLabel")}
        </FormLabel>
        <RadioGroup
          aria-labelledby="color-mode-select-label"
          value={colorMode}
          onChange={(e) => form.setField("colorMode", e.target.value as "light" | "dark")}
        >
          <FormControlLabel
            value="light"
            control={<Radio />}
            label={t("lightMode")}
          />
          <FormControlLabel
            value="dark"
            control={<Radio />}
            label={t("darkMode")}
          />
        </RadioGroup>
      </FormControl>

      <FormControl>
        <FormLabel id="context-menu-label" sx={{ mb: 1, fontWeight: 600 }}>
          {t("contextMenuLabel")}
        </FormLabel>
        <FormControlLabel
          control={
            <Checkbox
              checked={useCustomContextMenu}
              onChange={(e) => form.setField("useCustomContextMenu", e.target.checked)}
            />
          }
          label={t("useCustomContextMenu")}
        />
      </FormControl>

      <FormControl>
        <FormLabel id="cart-label" sx={{ mb: 1, fontWeight: 600 }}>
          {t("cartLabel")}
        </FormLabel>
        <FormControlLabel
          control={
            <Checkbox
              checked={useCart}
              onChange={(e) => form.setField("useCart", e.target.checked)}
            />
          }
          label={t("useCart")}
        />
      </FormControl>

      <FormControl>
        <FormLabel id="ai-label" sx={{ mb: 1, fontWeight: 600 }}>
          {t("aiLabelTitle")}
        </FormLabel>
        <FormControlLabel
          control={
            <Checkbox
              checked={showAiLabel}
              onChange={(e) => form.setField("showAiLabel", e.target.checked)}
            />
          }
          label={t("showAiLabel")}
        />
      </FormControl>

      <StickySaveBar open={form.dirty} saving={form.saving} onSave={form.submit} onDiscard={form.reset} />
    </Box>
  );
}
