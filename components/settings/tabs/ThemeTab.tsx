"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import Alert from "@mui/material/Alert";
import { useColorMode } from "@/components/ThemeRegistry";
import { useContextMenuContext } from "@/components/ui/ContextMenu";
import { cartEnabledStore, useCartEnabled } from "@/components/cart/cartStore";
import { useDirtyForm } from "@/lib/hooks/useDirtyForm";
import StickySaveBar from "@/components/ui/StickySaveBar";

/**
 * テーマ設定タブコンポーネント。
 * デフォルトの新しいテーマと、以前のUI（レガシーテーマ）を切り替えることができます。
 */
export default function ThemeTab() {
  const t = useTranslations("Settings.theme");
  const { isNewTheme, setThemeType } = useColorMode();
  const { setIsDisabled } = useContextMenuContext();
  const cartEnabled = useCartEnabled();
  const [success, setSuccess] = useState(false);

  const form = useDirtyForm(
    {
      selectedTheme: (isNewTheme ? "new" : "legacy") as "new" | "legacy",
      useCustomContextMenu: true,
      useCart: cartEnabled,
    },
    (values) => {
      setThemeType(values.selectedTheme);
      try {
        window.localStorage.setItem("disable_custom_context_menu", values.useCustomContextMenu ? "false" : "true");
        setIsDisabled(!values.useCustomContextMenu);
      } catch (e) {
        // ignore
      }
      cartEnabledStore.set(values.useCart);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  );
  const { selectedTheme, useCustomContextMenu, useCart } = form.values;

  // ローカルストレージ / カートストアの現在値を保存済みの初期値として取り込む
  useEffect(() => {
    let disabled = false;
    try {
      disabled = window.localStorage.getItem("disable_custom_context_menu") === "true";
    } catch (e) {
      // ignore
    }
    form.commit((prev) => ({ ...prev, useCustomContextMenu: !disabled, useCart: cartEnabled }));
  }, [cartEnabled, form.commit]);

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
          onChange={(e) => form.setField("selectedTheme", e.target.value as "new" | "legacy")}
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

      <StickySaveBar open={form.dirty} saving={form.saving} onSave={form.submit} onDiscard={form.reset} />
    </Box>
  );
}
