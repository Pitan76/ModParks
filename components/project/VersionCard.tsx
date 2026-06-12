import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";

interface VersionCardProps {
  version: {
    id:            string;
    versionNumber: string;
    mcVersions:    string[];
    loaders:       string[];
    changelog:     string;
    fileUrl:       string;
    fileName:      string;
    fileSize:      number | null;
    downloads:     number;
    createdAt:     Date | number;
  };
  projectSlug: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const LOADER_COLOR: Record<string, "default" | "primary" | "secondary" | "warning"> = {
  fabric:   "primary",
  forge:    "warning",
  neoforge: "warning",
  quilt:    "secondary",
  paper:    "secondary",
  spigot:   "secondary",
  bukkit:   "secondary",
  velocity: "secondary",
};

export default function VersionCard({ version, projectSlug }: VersionCardProps) {
  const date = new Date(
    typeof version.createdAt === "number"
      ? version.createdAt * 1000
      : version.createdAt
  );

  return (
    <Card
      id={`version-card-${version.id}`}
      sx={{ mb: 1.5, "&:hover": { borderColor: "primary.dark" } }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          {/* 左: バージョン情報 */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: "primary.main" }}>
                v{version.versionNumber}
              </Typography>

              {/* ローダー */}
              {version.loaders.map((loader) => (
                <Chip
                  key={loader}
                  label={loader}
                  size="small"
                  color={LOADER_COLOR[loader] ?? "default"}
                  sx={{ height: 20, fontSize: "0.65rem", textTransform: "capitalize" }}
                />
              ))}

              {/* MC バージョン */}
              {version.mcVersions.slice(0, 3).map((mc) => (
                <Chip
                  key={mc}
                  label={mc}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: "0.65rem", borderColor: "divider", color: "text.secondary" }}
                />
              ))}
              {version.mcVersions.length > 3 && (
                <Typography variant="caption" color="text.disabled">
                  +{version.mcVersions.length - 3}
                </Typography>
              )}
            </Box>

            {/* 更新内容 */}
            {version.changelog && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display:         "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow:        "hidden",
                }}
              >
                {version.changelog}
              </Typography>
            )}

            {/* メタ情報 */}
            <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled">
                  {date.toLocaleDateString("ja-JP")}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <DownloadIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                <Typography variant="caption" color="text.disabled">
                  {version.downloads.toLocaleString()}
                </Typography>
              </Box>
              {version.fileSize && (
                <Typography variant="caption" color="text.disabled">
                  {formatBytes(version.fileSize)}
                </Typography>
              )}
            </Stack>
          </Box>

          {/* 右: DLボタン */}
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button
              id={`download-btn-${version.id}`}
              variant="contained"
              size="small"
              startIcon={<DownloadIcon />}
              href={`/api/download/${version.id}`}
              sx={{ whiteSpace: "nowrap" }}
            >
              Download
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
