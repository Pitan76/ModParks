import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import { getAdsMode, getAdsenseClient, getAdSlotId, type AdSlotName } from "@/lib/config/ads";
import AdSenseUnit from "./AdSenseUnit";

interface AdSlotProps {
  /** 広告枠の識別子。`AD_SLOT_IDS` に登録済みのものだけ指定できる */
  slot: AdSlotName;
  /** 目安の高さ（px）。プレビュー枠の高さにも使う */
  minHeight?: number;
  /** スマホ幅（xs）で非表示にするか。既定は非表示 */
  hideOnMobile?: boolean;
}

/**
 * 広告枠を表示するコンポーネント。
 * モードに応じて、非表示 / 位置プレビュー / 実配信 を切り替える。
 */
export default async function AdSlot({
  slot,
  minHeight = 90,
  hideOnMobile = true,
}: AdSlotProps) {
  const mode = getAdsMode();
  if (mode === "off") return null;

  const client = getAdsenseClient();
  const slotId = getAdSlotId(slot);

  // パブリッシャーIDか広告ユニットIDが未設定の枠は、実配信できないので何も出さない
  if (mode === "on") {
    if (!client || !slotId) return null;
    return (
      <AdSenseUnit
        client={client}
        slotId={slotId}
        minHeight={minHeight}
        hideOnMobile={hideOnMobile}
      />
    );
  }

  const t = await getTranslations("Ads");

  return (
    <Box
      data-ad-slot={slot}
      sx={{
        display: hideOnMobile ? { xs: "none", sm: "flex" } : "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        width: "100%",
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        color: "text.disabled",
        bgcolor: "action.hover",
      }}
    >
      <Typography variant="caption">{t("previewLabel")}</Typography>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {slot}
      </Typography>
    </Box>
  );
}
