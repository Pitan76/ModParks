import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";
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
        <Typography variant="caption" color="text.disabled" sx={{ mb: 0.5, display: "block" }}>
          ライセンス
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {p.license}
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ソースコード */}
      {p.sourceUrl && (
        <Box sx={{ mb: 2 }}>
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
            ソースコード
          </Button>
        </Box>
      )}

      {/* タグ */}
      {p.tags.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: "block" }}>
            タグ
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {p.tags.map((tag: string) => (
              <Chip
                key={tag}
                label={tag}
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
