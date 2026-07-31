import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import { getAdsMode, getAdsenseClient, getAdSlotId, type AdSlotName } from "@/lib/config/ads";
import AdSenseUnit from "./AdSenseUnit";
import { isAdFreeViewer } from "@/lib/ads/adsServer";

interface AdSlotProps {
  /** 広告枠の識別子。`AD_SLOT_IDS` に登録済みのものだけ指定できる */
  slot: AdSlotName;
  /** 目安の高さ（px）。プレビュー枠の高さにも使う */
  minHeight?: number;
  /** スマホ幅（xs）で非表示にするか。既定は非表示 */
  hideOnMobile?: boolean;
  /**
   * 広告の形状。既定の "auto" は枠幅に応じて最も収益期待値の高い形を選ぶため、
   * 幅が広いと縦に大きいレクタングルになりやすい。
   * 横長バナーに収めたい枠では "horizontal" を指定する。
   */
  format?: "auto" | "horizontal" | "rectangle" | "vertical";
  /**
   * 高さの上限（px）。指定すると広告がこの高さを超えて伸びない。
   * 形状指定だけでは足りない枠の保険として使う。
   */
  maxHeight?: number;
}

/**
 * 広告枠を表示するコンポーネント。
 * モードに応じて、非表示 / 位置プレビュー / 実配信 を切り替える。
 */
export default async function AdSlot({
  slot,
  minHeight = 90,
  hideOnMobile = true,
  format = "auto",
  maxHeight,
}: AdSlotProps) {
  const mode = getAdsMode();
  if (mode === "off") return null;

  // プレミアムは広告非表示。プレビュー枠も出さない（実際の見え方に合わせる）
  if (await isAdFreeViewer()) return null;

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
        format={format}
        maxHeight={maxHeight}
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
        bgcolor: "transparent",
      }}
    >
      <Typography variant="caption">{t("previewLabel")}</Typography>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {slot}
      </Typography>
    </Box>
  );
}
