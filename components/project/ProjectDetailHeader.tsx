import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import EditableProjectIcon from "./EditableProjectIcon";
import LinkButton from "@/components/ui/LinkButton";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { useTranslations } from "next-intl";
import Tooltip from "@mui/material/Tooltip";
import ProjectFavoriteButton from "./ProjectFavoriteButton";
import AddToCollectionButton from "./AddToCollectionButton";
import ProjectHeaderMenu from "./ProjectHeaderMenu";
import { AuthorLabel, DownloadLabel, DateLabel } from "@/components/ui/ProjectInfoLabels";
import { SITE_URL } from "@/lib/config";
import ProjectTypeBadge from "./ProjectTypeBadge";

export type ProjectDetailHeaderProps = {
  /** 対象プロジェクトの情報 */
  project: {
    id: string;
    title: string;
    slug: string;
    type: string;
    visibility: string;
    body: string;
    iconUrl?: string | null;
    downloads: number;
    totalDownloads: number;
    externalDownloads?: Record<string, number> | null;
    modrinthId?: string | null;
    curseforgeId?: string | null;
    sourceIdeaId?: string | null;
    sourceIdeaTitle?: string | null;
    createdAt: Date;
    updatedAt: Date;
    /** left join のため、作者が削除済みなどで null になりうる */
    author: {
      username: string | null;
      displayName: string | null;
      avatarUrl?: string | null;
    } | null;
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
  /** 新リリース通知を購読しているか */
  isSubscribed?: boolean;
};

/**
 * プロジェクト詳細のヘッダーおよびメタデータ（ダウンロード数、お気に入り、作成日時等）を描画するコンポーネント。
 */
const ProjectDetailHeader = ({
  project: p,
  canEdit,
  isFavorited,
  favoritesCount,
  isLoggedIn,
  currentUserId,
  isSubscribed = false
}: ProjectDetailHeaderProps) => {
  const tProject = useTranslations("Project");
  const tCommon = useTranslations("Common");

  return (
    <>
      <Breadcrumb
        items={[
          { label: tCommon("projects"), href: "/projects" },
          { label: p.title },
        ]}
      />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", flex: "1 1 300px", minWidth: 0 }}>
          <EditableProjectIcon 
            projectId={p.id}
            projectSlug={p.slug}
            projectName={p.title}
            initialIconUrl={p.iconUrl}
            canEdit={canEdit}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: { xs: "1.5rem", sm: "2.125rem" } }}>
                {p.title}
              </Typography>
              <ProjectTypeBadge type={p.type} size="small" />
              {p.visibility !== "public" && (
                <Chip
                  label={tCommon(`visibility.${p.visibility}`)}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}
              {p.sourceIdeaId && p.sourceIdeaTitle && (
                <Tooltip title={tProject("sourceIdeaTooltip")}>
                  <LinkButton
                    href={`/ideas/${p.sourceIdeaId}`}
                    variant="outlined"
                    size="small"
                    sx={{ borderRadius: "16px", py: 0, px: 1, textTransform: "none", color: "text.secondary", borderColor: "divider", maxWidth: { xs: 200, sm: 320 }, minWidth: 0, "&:hover": { borderColor: "primary.main", color: "primary.main", bgcolor: "transparent" } }}
                  >
                    <Box component="span" sx={{ mr: 0.5, flexShrink: 0 }}>💡</Box>
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                      {p.sourceIdeaTitle}
                    </Box>
                  </LinkButton>
                </Tooltip>
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
              
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { sm: 2 } }}>
                <ProjectFavoriteButton
                  projectId={p.id}
                  initialCount={favoritesCount}
                  initialFavorited={isFavorited}
                  isLoggedIn={isLoggedIn}
                  variant="icon"
                />
                {isLoggedIn && currentUserId && (
                  <AddToCollectionButton projectId={p.id} userId={currentUserId} variant="icon" />
                )}
                <ProjectHeaderMenu
                  project={{ id: p.id, slug: p.slug, title: p.title, iconUrl: p.iconUrl, type: p.type }}
                  shareUrl={`${SITE_URL}/projects/${p.slug}`}
                  isLoggedIn={isLoggedIn}
                  isSubscribed={isSubscribed}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default ProjectDetailHeader;
