import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import { getLoaderInfo } from "@/lib/loaders";

export type LoaderBadgeListProps = {
  loaders: string[];
  size?: "small" | "medium";
};

/**
 * 対応ローダー（プラットフォーム）のバッジ列。
 *
 * ローダーは正式名とアイコン・色が決まっているため、生の slug をそのまま出さず
 * 必ず {@link getLoaderInfo} を通す。プロジェクトとアイデアで見た目を揃えるために共通化している。
 */
export default function LoaderBadgeList({ loaders, size = "small" }: LoaderBadgeListProps) {
  if (loaders.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
      {loaders.map((loader) => {
        const info = getLoaderInfo(loader);
        return <Chip key={loader} label={info.name} size={size} color={info.color} icon={info.icon} />;
      })}
    </Stack>
  );
}
