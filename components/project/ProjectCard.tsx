"use client";

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
import Tooltip from "@mui/material/Tooltip";
import { Link, useRouter } from "@/i18n/routing";
import LinkCardActionArea from "@/components/ui/LinkCardActionArea";
import { useTranslations } from "next-intl";
import { DownloadLabel, DateLabel } from "@/components/ui/ProjectInfoLabels";
import { toPlainDescription } from "@/lib/utils/plainText";

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
    type:        "mod" | "plugin" | "resourcepack" | "datapack" | "shader" | "modpack";
    license:     string;
    downloads:   number;
    totalDownloads: number;
    externalDownloads?: Record<string, number> | null;
    modrinthId?: string | null;
    curseforgeId?: string | null;
    tags:        string[];
    authorUsername?: string | null;
    authorDisplayName?: string | null;
    authorAvatarUrl?: string | null;
    updatedAt:   Date | number;
  };
  layout?: "list" | "grid";
}

const TYPE_COLOR: Record<ProjectCardProps["project"]["type"], "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning"> = {
  mod:          "primary",
  plugin:       "secondary",
  resourcepack: "success",
  datapack:     "warning",
  shader:       "info",
  modpack:      "error",
};

const TYPE_LABEL: Record<ProjectCardProps["project"]["type"], string> = {
  mod:          "Mod",
  plugin:       "Plugin",
  resourcepack: "Resource Pack",
  datapack:     "Data Pack",
  shader:       "Shader",
  modpack:      "Modpack",
};


/**
 * プロジェクトをカード形式で表示するコンポーネント
 * @param props ProjectCardProps プロジェクトのメタ情報や作者情報を含む
 */
export default function ProjectCard({ project, layout = "list" }: ProjectCardProps) {
  const tTags = useTranslations("Tags");
  const router = useRouter();
  const isGrid = layout === "grid";

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return tTags.has(key as any) ? tTags(key as any) : tag;
  };

  // Ensure tags is always an array to avoid undefined errors
  const safeTags: string[] = project.tags ?? [];

  return (
    <Card id={`project-card-${project.slug}`} style={{ boxShadow: "none" }} sx={{ height: "100%" }}>
      <LinkCardActionArea href={`/projects/${project.slug}`} sx={{ height: "100%" }}>
        <CardContent 
          sx={{ 
            p: 2, 
            display: "flex", 
            flexDirection: isGrid ? "column" : { xs: "column", sm: "row" }, 
            alignItems: isGrid ? "stretch" : { xs: "stretch", sm: "center" }, 
            gap: 2,
            height: "100%"
          }}
        >
          {/* Top Section: Icon + Main Info (Always row, wrap if extremely narrow) */}
          <Box sx={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 2, alignItems: "flex-start", flex: isGrid ? "none" : { xs: "none", sm: 1 }, minWidth: 0 }}>
            {/* アイコン */}
            <Avatar
              src={project.iconUrl ?? undefined}
              alt={project.name}
              variant="rounded"
              slotProps={{ img: { loading: "lazy", decoding: "async" } }}
              sx={{
                width: 48,
                height: 48,
                flexShrink: 0,
              }}
            >
              <ExtensionIcon />
            </Avatar>

            {/* メイン情報（タイトル・説明・作者） */}
            <Box sx={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0 }}>
                <Typography 
                  variant="subtitle1" 
                  component="h3" 
                  title={project.name}
                  sx={{ 
                    fontWeight: 600, 
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0
                  }}
                >
                  {project.name}
                </Typography>
                <Chip
                  label={TYPE_LABEL[project.type]}
                  color={TYPE_COLOR[project.type]}
                  size="small"
                  sx={{ height: 20, fontSize: "0.65rem", flexShrink: 0 }}
                />
              </Box>
              
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: isGrid ? 2 : { xs: 2, sm: 1 },
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  lineHeight: 1.4,
                  mt: 0.5,
                  wordBreak: "break-all",
                  overflowWrap: "break-word"
                }}
              >
                {toPlainDescription(project.description)}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ minWidth: 0 }}
                >
                  by {project.authorDisplayName || project.authorUsername || "Unknown"}
                </Typography>
                {/* 広い画面（リスト表示のsm以上）では作者名の横に日付を置く。狭い場合はDL数の横へ回す */}
                <Box sx={{ display: isGrid ? "none" : { xs: "none", sm: "flex" }, alignItems: "center", gap: 0.5, flexShrink: 0 }}>
                  <Typography variant="caption" color="text.disabled">•</Typography>
                  <DateLabel date={project.updatedAt} type="updated" textVariant="caption" textColor="text.disabled" hideIcon />
                </Box>
              </Box>
            </Box>
          </Box>

          {/* メタ情報（ダウンロード数など） */}
          <Box 
            sx={{ 
              display: "flex", 
              flexDirection: isGrid ? "row" : { xs: "row", sm: "column" }, 
              alignItems: isGrid ? "center" : { xs: "center", sm: "flex-end" }, 
              justifyContent: isGrid ? "space-between" : "flex-start",
              width: isGrid ? "100%" : { xs: "100%", sm: "auto" },
              gap: isGrid ? 2 : { xs: 2, sm: 0.5 }, 
              flexShrink: 0,
              mt: isGrid ? "auto" : { xs: "auto", sm: 0 }
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", minWidth: 0 }}>
              <DownloadLabel
                downloads={project.downloads}
                totalDownloads={project.totalDownloads}
                externalDownloads={project.externalDownloads}
                modrinthId={project.modrinthId}
                curseforgeId={project.curseforgeId}
                iconSize="1rem"
                textVariant="body2"
                textColor="text.secondary"
                iconColor="text.secondary"
              />
              {/* 狭い画面・グリッド表示ではDL数の横に日付を置く */}
              <Box sx={{ display: isGrid ? "flex" : { xs: "flex", sm: "none" }, alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Typography variant="caption" color="text.disabled">•</Typography>
                <DateLabel date={project.updatedAt} type="updated" textVariant="caption" textColor="text.disabled" hideIcon />
              </Box>
            </Box>
            
            {safeTags.length > 0 && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: isGrid ? 0 : { xs: 0, sm: 1 }, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {safeTags.slice(0, isGrid ? 2 : 3).map((tag) => (
                  <Chip
                    key={tag}
                    label={getTagLabel(tag)}
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/projects?tags=${encodeURIComponent(tag)}`);
                    }}
                    sx={{ height: 18, fontSize: "0.6rem", borderColor: "divider" }}
                  />
                ))}
                {safeTags.length > (isGrid ? 2 : 3) && (
                  <Tooltip title={safeTags.slice(isGrid ? 2 : 3).map(getTagLabel).join(", ")} arrow placement="top">
                    <Box
                      component="span"
                      sx={{ display: "inline-flex", alignItems: "center", height: 18, cursor: "help", color: "text.disabled", fontSize: "0.65rem", lineHeight: 1 }}
                    >
                      +{safeTags.length - (isGrid ? 2 : 3)}
                    </Box>
                  </Tooltip>
                )}
              </Box>
            )}
          </Box>
        </CardContent>
      </LinkCardActionArea>
    </Card>
  );
}
