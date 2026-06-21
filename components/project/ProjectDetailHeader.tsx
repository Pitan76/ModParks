import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import EditableProjectIcon from "./EditableProjectIcon";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import LinkButton from "@/components/ui/LinkButton";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import HomeIcon from "@mui/icons-material/Home";
import { useTranslations, useFormatter, useLocale } from "next-intl";
import Tooltip from "@mui/material/Tooltip";
import { formatCompactNumber } from "@/lib/utils/format";
import ProjectFavoriteButton from "./ProjectFavoriteButton";
import AddToCollectionButton from "./AddToCollectionButton";
import { AuthorLabel, DownloadLabel, DateLabel } from "@/components/ui/ProjectInfoLabels";

/**
 * プロジェクト詳細のヘッダーおよび説明文を表示するコンポーネント
 */
export interface ProjectDetailHeaderProps {
  /** 対象プロジェクトの情報 */
  project: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
    description: string;
    iconUrl?: string | null;
    downloads: number;
    totalDownloads: number;
    externalDownloads?: Record<string, number> | null;
    modrinthId?: string | null;
    curseforgeId?: string | null;
    createdAt: Date;
    updatedAt: Date;
    author: {
      username: string;
      displayName: string;
      avatarUrl?: string | null;
    };
  };
  /** ユーザーがこのプロジェクトの編集権限を持っているか */
  canEdit: boolean;
  /** ユーザーがお気に入り登録しているか */
  isFavorited: boolean;
  /** プロジェクトのお気に入り総数 */
  favoritesCount: number;
  /** ログイン状態 */
  isLoggedIn: boolean;
  /** ログインユーザーID（リスト追加等に使用） */
  currentUserId?: string;
}

export default function ProjectDetailHeader({ 
  project: p, 
  canEdit, 
  isFavorited, 
  favoritesCount, 
  isLoggedIn,
  currentUserId
}: ProjectDetailHeaderProps) {
  const tProject = useTranslations("Project");
  const tCommon = useTranslations("Common");

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, typography: "body2", color: "text.secondary" }}>
          <LinkButton href="/" variant="text" sx={{ p: 0, minWidth: "auto", color: "text.secondary", "&:hover": { bgcolor: "transparent", color: "primary.main" } }}>
            <HomeIcon fontSize="small" />
          </LinkButton>
          <span>/</span>
          <LinkButton href="/projects" variant="text" sx={{ p: 0, minWidth: "auto", color: "text.secondary", "&:hover": { bgcolor: "transparent", color: "primary.main" } }}>
            {tCommon("projects")}
          </LinkButton>
          <span>/</span>
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
            {p.name}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", flex: "1 1 300px", minWidth: 0 }}>
          <EditableProjectIcon 
            projectId={p.id}
            projectSlug={p.slug}
            projectName={p.name}
            initialIconUrl={p.iconUrl}
            canEdit={canEdit}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              {p.name}
            </Typography>
            <Chip
              label={p.type === "mod" ? "Mod" : "Plugin"}
              color={p.type === "mod" ? "primary" : "secondary"}
              size="small"
            />
            {p.status !== "public" && (
              <Chip
                label={tProject(`status.${p.status}`)}
                color="warning"
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <AuthorLabel author={p.author} />
            <Typography variant="body2" color="text.disabled">·</Typography>
            <DownloadLabel 
              downloads={p.downloads} 
              totalDownloads={p.totalDownloads} 
              externalDownloads={p.externalDownloads} 
              modrinthId={p.modrinthId} 
              curseforgeId={p.curseforgeId} 
            />
          </Box>
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, flexWrap: "wrap" }}>
            <DateLabel date={p.createdAt} type="published" />
            <DateLabel date={p.updatedAt} type="updated" />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: { xs: "row", sm: "column" }, gap: 1, width: { xs: "100%", sm: "auto" }, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", gap: 1, width: { xs: "100%", sm: "auto" } }}>
            <Box sx={{ flex: { xs: 1, sm: "initial" } }}>
              <ProjectFavoriteButton
                projectId={p.id}
                initialCount={favoritesCount}
                initialFavorited={isFavorited}
                isLoggedIn={isLoggedIn}
                variant="icon"
              />
            </Box>
            {isLoggedIn && currentUserId && (
              <Box sx={{ flex: { xs: 1, sm: "initial" } }}>
                <AddToCollectionButton projectId={p.id} userId={currentUserId} variant="icon" />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </>
  );
}
