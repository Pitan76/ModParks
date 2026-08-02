"use client";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import ExtensionIcon from "@mui/icons-material/Extension";
import LinkCardActionArea from "@/components/ui/LinkCardActionArea";
import { DateLabel } from "@/components/ui/ProjectInfoLabels";
import { toPlainDescription } from "@/lib/utils/plainText";
import { useCartEnabled } from "@/components/cart/cartStore";
import ProjectTypeBadge from "./ProjectTypeBadge";
import CartToggleButton from "./card/CartToggleButton";
import ProjectCardMeta from "./card/ProjectCardMeta";
import { useProjectContextMenu } from "./card/useProjectContextMenu";

export type ProjectCardProps = {
  project: {
    id:          string;
    slug:        string;
    title:       string;
    body:        string;
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
  /** カート追加/削除ボタンを表示するか（既定: true） */
  showCart?: boolean;
};

/**
 * プロジェクト一覧などで個々のプロジェクト概要を表示するカードコンポーネント。
 * リスト表示とグリッド表示の2レイアウトに対応し、コンテキストメニュー機能も備えます。
 */
const ProjectCard = ({ project, layout = "list", showCart = true }: ProjectCardProps) => {
  const isGrid = layout === "grid";
  const onContextMenu = useProjectContextMenu(project);
  const cartEnabled = useCartEnabled();

  // 設定でカート機能自体をオフにしている場合はボタンを出さない
  const showCartButton = showCart && cartEnabled;

  // グリッドではカード右上に浮かせ、リストではメタ情報の行に並べるため要素を共有する
  const cartButton = showCartButton ? (
    <CartToggleButton
      item={{
        id: project.id,
        slug: project.slug,
        title: project.title,
        iconUrl: project.iconUrl,
        type: project.type,
      }}
    />
  ) : null;

  return (
    <Card
      id={`project-card-${project.slug}`}
      onContextMenu={onContextMenu}
      style={{ boxShadow: "none" }}
      sx={{ height: "100%", position: "relative" }}
    >
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
          {isGrid && cartButton && (
            <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>{cartButton}</Box>
          )}

          {/* グリッドでは右上のカートボタンとタイトルが重ならないよう余白を空ける */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "flex-start",
              flex: isGrid ? "none" : { xs: "none", sm: 1 },
              minWidth: 0,
              pr: isGrid && showCartButton ? 4.5 : 0,
            }}
          >
            <Avatar
              src={project.iconUrl ?? undefined}
              alt={project.title}
              variant="rounded"
              slotProps={{ img: { loading: "lazy", decoding: "async" } }}
              sx={{ width: 48, height: 48, flexShrink: 0 }}
            >
              <ExtensionIcon />
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0 }}>
                <Tooltip title={project.title} arrow placement="top">
                  <Typography
                    variant="subtitle1"
                    component="h3"
                    sx={{
                      fontWeight: 600,
                      lineHeight: 1.2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minWidth: 0,
                    }}
                  >
                    {project.title}
                  </Typography>
                </Tooltip>
                <ProjectTypeBadge type={project.type} />
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
                {toPlainDescription(project.body)}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
                  by {project.authorDisplayName || project.authorUsername || "Unknown"}
                </Typography>
                {/* 広い画面（リスト表示のsm以上）では作者名の横に日付を置く。狭い場合はDL数の横へ回す */}
                <Box
                  sx={{
                    display: isGrid ? "none" : { xs: "none", sm: "flex" },
                    alignItems: "center",
                    gap: 0.5,
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" color="text.disabled">•</Typography>
                  <DateLabel date={project.updatedAt} type="updated" textVariant="caption" textColor="text.disabled" hideIcon />
                </Box>
              </Box>
            </Box>
          </Box>

          <ProjectCardMeta
            downloads={project.downloads}
            totalDownloads={project.totalDownloads}
            externalDownloads={project.externalDownloads}
            modrinthId={project.modrinthId}
            curseforgeId={project.curseforgeId}
            updatedAt={project.updatedAt}
            tags={project.tags ?? []}
            isGrid={isGrid}
            cartButton={isGrid ? undefined : cartButton}
          />
        </CardContent>
      </LinkCardActionArea>
    </Card>
  );
};

export default ProjectCard;
