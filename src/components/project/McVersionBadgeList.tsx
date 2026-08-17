import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";

export type McVersionBadgeListProps = {
  mcVersions: string[];
  /**
   * 展開して表示する件数。超過分は「+N」にまとめ、ツールチップで全件見せる。
   * 省略時は全件を並べる（サイドバーなど、幅に余裕がある場所向け）。
   */
  visibleCount?: number;
  size?: "small" | "medium";
};

/**
 * 対応MCバージョンのバッジ列。
 *
 * 対応バージョンは十数件になることがあり、そのまま並べると見出しを押し出してしまう。
 * visibleCount を渡した場所では超過分を「+N」に畳む。
 */
export default function McVersionBadgeList({ mcVersions, visibleCount, size = "small" }: McVersionBadgeListProps) {
  if (mcVersions.length === 0) return null;

  const shown = visibleCount === undefined ? mcVersions : mcVersions.slice(0, visibleCount);
  const hidden = visibleCount === undefined ? [] : mcVersions.slice(visibleCount);

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
      {shown.map((mc) => (
        <Chip
          key={mc}
          label={mc}
          size={size}
          variant="outlined"
          sx={{ borderColor: "divider", color: "text.secondary" }}
        />
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join(", ")} arrow placement="top">
          <Box
            component="span"
            sx={{ cursor: "help", color: "text.disabled", fontSize: "0.75rem", lineHeight: 1 }}
          >
            +{hidden.length}
          </Box>
        </Tooltip>
      )}
    </Stack>
  );
}
