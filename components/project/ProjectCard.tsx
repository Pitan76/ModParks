import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import DownloadIcon from "@mui/icons-material/Download";
import ExtensionIcon from "@mui/icons-material/Extension";
import { Link } from "@/i18n/routing";
import LinkCardActionArea from "@/components/ui/LinkCardActionArea";
import { formatCompactNumber } from "@/lib/utils/format";
import { useLocale } from "next-intl";

/**
 * プロジェクト一覧のカードに表示するデータの型定義
 */
export interface ProjectCardProps {
  project: {
    id:          string;
    slug:        string;
    name:        string;
    description: string;
    iconUrl:     string | null;
    type:        "mod" | "plugin";
    license:     string;
    downloads:   number;
    tags:        string[];
    authorUsername?: string | null;
    authorDisplayName?: string | null;
    authorAvatarUrl?: string | null;
    updatedAt:   Date | number;
  };
}

const TYPE_COLOR = {
  mod:    "primary",
  plugin: "secondary",
} as const;

const TYPE_LABEL = {
  mod:    "Mod",
  plugin: "Plugin",
} as const;


/**
 * プロジェクトをカード形式で表示するコンポーネント
 * @param props ProjectCardProps プロジェクトのメタ情報や作者情報を含む
 */
export default function ProjectCard({ project }: ProjectCardProps) {
  const locale = useLocale();

  return (
    <Card id={`project-card-${project.slug}`}>
      <LinkCardActionArea href={`/projects/${project.slug}`}>
        <CardContent sx={{ p: 2.5 }}>
          {/* ヘッダー: アイコン + タイプ */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", mb: 1.5 }}>
            <Avatar
              src={project.iconUrl ?? undefined}
              alt={project.name}
              variant="rounded"
              sx={{
                width:  56,
                height: 56,
                bgcolor: "primary.dark",
                border: "2px solid",
                borderColor: "primary.dark",
                flexShrink: 0,
              }}
            >
              <ExtensionIcon />
            </Avatar>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                <Typography
                  variant="subtitle1"
                  component="h3"
                  sx={{ fontWeight: 700, lineHeight: 1.3 }}
                  noWrap
                >
                  {project.name}
                </Typography>
                <Chip
                  label={TYPE_LABEL[project.type]}
                  color={TYPE_COLOR[project.type]}
                  size="small"
                  sx={{ height: 20, fontSize: "0.65rem" }}
                />
              </Box>

              {/* 作者 */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Avatar
                  src={project.authorAvatarUrl ?? undefined}
                  alt={project.authorDisplayName || "Unknown"}
                  sx={{ width: 18, height: 18 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {project.authorDisplayName || "Unknown"}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* 説明 */}
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display:            "-webkit-box",
              WebkitLineClamp:    2,
              WebkitBoxOrient:    "vertical",
              overflow:           "hidden",
              mb:                 1.5,
              minHeight:          "2.4em",
            }}
          >
            {project.description}
          </Typography>

          {/* タグ */}
          {project.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 1.5, flexWrap: "wrap" }}>
              {project.tags.slice(0, 4).map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{
                    height:      20,
                    fontSize:    "0.65rem",
                    borderColor: "divider",
                    color:       "text.secondary",
                  }}
                />
              ))}
              {project.tags.length > 4 && (
                <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center" }}>
                  +{project.tags.length - 4}
                </Typography>
              )}
            </Stack>
          )}

          {/* ダウンロード数 + ライセンス */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <DownloadIcon fontSize="small" sx={{ color: "text.disabled", fontSize: 16 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatCompactNumber(project.downloads, locale)}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.disabled">
              {project.license}
            </Typography>
          </Box>
        </CardContent>
      </LinkCardActionArea>
    </Card>
  );
}
