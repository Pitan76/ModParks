import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import ReportIcon from "@mui/icons-material/Report";
import GavelIcon from "@mui/icons-material/Gavel";
import CodeIcon from "@mui/icons-material/Code";
import { useTranslations } from "next-intl";
import ReportDialog from "@/components/project/ReportDialog";

/**
 * プロジェクト詳細のサイドバーを表示するコンポーネント
 */
export interface ProjectSidebarProps {
  /** 対象プロジェクトの情報 */
  project: {
    id: string;
    license: string;
    sourceUrl?: string | null;
    tags: string[];
  };
  /** ログイン済みか (通報ボタンの表示判定用) */
  isAuthenticated: boolean;
}

export default function ProjectSidebar({ project: p, isAuthenticated }: ProjectSidebarProps) {
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return tTags.has(key as any) ? tTags(key as any) : tag;
  };

  return (
    <Box
      sx={{
        bgcolor:      "background.paper",
        border:       "1px solid",
        borderColor:  "divider",
        borderRadius: 2,
        p:            2.5,
        position:     { md: "sticky" },
        top:          { md: 80 },
      }}
    >
      {/* ライセンス */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <GavelIcon fontSize="small" color="action" />
          {t("sidebar.license")}
        </Typography>
        <Typography variant="body2">
          {p.license}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ソースコード */}
      {p.sourceUrl && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <CodeIcon fontSize="small" color="action" />
            {t("sidebar.sourceCode")}
          </Typography>
          <Button
            id="source-code-btn"
            href={p.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<GitHubIcon />}
            fullWidth
            variant="outlined"
            size="small"
          >
            GitHub
          </Button>
        </Box>
      )}

      {/* タグ */}
      {p.tags.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <LocalOfferIcon fontSize="small" color="action" />
            {t("sidebar.tags")}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {p.tags.map((tag: string) => (
              <Chip
                key={tag}
                label={getTagLabel(tag)}
                size="small"
                variant="outlined"
                sx={{ borderColor: "divider", color: "text.secondary" }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* 通報 */}
      {isAuthenticated && (
        <ReportDialog projectId={p.id} />
      )}
    </Box>
  );
}
