import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import { getAdsMode } from "@/lib/config/ads";

interface AdSlotProps {
  /** 広告枠の識別子。将来の配信・計測用 */
  slot: string;
  /** 目安の高さ（px）。プレビュー枠の高さにも使う */
  minHeight?: number;
}

/**
 * 広告枠を表示するコンポーネント。
 * モードに応じて、非表示 / 位置プレビュー / 実配信 を切り替える。
 * 現状 "on" の実配信はプレースホルダーのみで、配信機構は未接続。
 */
export default async function AdSlot({ slot, minHeight = 90 }: AdSlotProps) {
  const mode = getAdsMode();
  if (mode === "off") return null;

  const t = await getTranslations("Ads");

  return (
    <Box
      data-ad-slot={slot}
      sx={{
        display: "flex",
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
      <Typography variant="caption">
        {mode === "preview" ? t("previewLabel") : t("label")}
      </Typography>
      {mode === "preview" && (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {slot}
        </Typography>
      )}
    </Box>
  );
}
