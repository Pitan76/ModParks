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
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
        <CardContent sx={{ p: 2, display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, gap: 2 }}>
          {/* アイコン */}
          <Avatar
            src={project.iconUrl ?? undefined}
            alt={project.name}
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              bgcolor: "primary.dark",
              flexShrink: 0,
            }}
          >
            <ExtensionIcon />
          </Avatar>

          {/* メイン情報（タイトル・説明・作者） */}
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {project.name}
              </Typography>
              <Chip
                label={TYPE_LABEL[project.type]}
                color={TYPE_COLOR[project.type]}
                size="small"
                sx={{ height: 20, fontSize: "0.65rem" }}
              />
            </Box>
            
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.4,
              }}
            >
              {project.description}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                by {project.authorDisplayName || project.authorUsername || "Unknown"}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                • {new Date(project.updatedAt).toLocaleDateString()}
              </Typography>
            </Box>
          </Box>

          {/* メタ情報（ダウンロード数など） */}
          <Box sx={{ display: "flex", flexDirection: { xs: "row", sm: "column" }, alignItems: { xs: "center", sm: "flex-end" }, gap: { xs: 2, sm: 0.5 }, flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
              <DownloadIcon sx={{ fontSize: "1rem" }} />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {formatCompactNumber(project.downloads, locale)}
              </Typography>
            </Box>
            
            {project.tags.length > 0 && (
              <Box sx={{ display: "flex", gap: 0.5, mt: { xs: 0, sm: 1 } }}>
                {project.tags.slice(0, 3).map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: "0.6rem", borderColor: "divider" }}
                  />
                ))}
                {project.tags.length > 3 && (
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5 }}>
                    +{project.tags.length - 3}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </CardContent>
      </LinkCardActionArea>
    </Card>
  );
}
