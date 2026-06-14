import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import ExtensionIcon from "@mui/icons-material/Extension";
import EditIcon from "@mui/icons-material/Edit";
import DownloadIcon from "@mui/icons-material/Download";
import Button from "@mui/material/Button";
import LinkButton from "@/components/ui/LinkButton";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";

/**
 * プロジェクト詳細のヘッダーおよび説明文を表示するコンポーネント
 */
export interface ProjectDetailHeaderProps {
  /** 対象プロジェクトの情報 */
  project: {
    name: string;
    slug: string;
    type: string;
    description: string;
    iconUrl?: string | null;
    downloads: number;
    createdAt: Date;
    updatedAt: Date;
    author: {
      displayName: string;
      avatarUrl?: string | null;
    };
  };
  /** ユーザーがこのプロジェクトの編集権限を持っているか */
  canEdit: boolean;
}

export default function ProjectDetailHeader({ project: p, canEdit }: ProjectDetailHeaderProps) {
  const tProject = useTranslations("Project");
  const tCommon = useTranslations("Common");

  return (
    <>
      <Box sx={{ display: "flex", gap: 2.5, alignItems: "flex-start", mb: 3 }}>
        <Avatar
          src={p.iconUrl ?? undefined}
          alt={p.name}
          variant="rounded"
          sx={{
            width: 80, height: 80, bgcolor: "primary.dark",
            border: "2px solid", borderColor: "divider",
          }}
        >
          <ExtensionIcon sx={{ fontSize: 40 }} />
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
              {p.name}
            </Typography>
            <Chip
              label={p.type === "mod" ? "Mod" : "Plugin"}
              color={p.type === "mod" ? "primary" : "secondary"}
              size="small"
            />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <Avatar src={p.author.avatarUrl ?? undefined} sx={{ width: 22, height: 22 }} />
            <Typography variant="body2" color="text.secondary">
              {p.author.displayName}
            </Typography>
            <Typography variant="body2" color="text.disabled">·</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <DownloadIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              <Typography variant="body2" color="text.disabled">
                {p.downloads.toLocaleString()}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
              <AccessTimeIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">
                {tProject("header.publishedAt", { date: new Date(p.createdAt).toLocaleDateString() })}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
              <EditIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">
                {tProject("header.updatedAt", { date: new Date(p.updatedAt).toLocaleDateString() })}
              </Typography>
            </Box>
          </Box>
        </Box>

        {canEdit && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <LinkButton
              variant="outlined"
              startIcon={<EditIcon />}
              href={`/projects/${p.slug}/edit`}
            >
              {tCommon("edit")}
            </LinkButton>
            <LinkButton
              variant="contained"
              startIcon={<AddIcon />}
              href={`/projects/${p.slug}/versions/new`}
            >
              {tProject("header.addVersion")}
            </LinkButton>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          bgcolor: "background.paper",
          border:  "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          p: 3,
          mb: 3,
          "& pre": { whiteSpace: "pre-wrap", fontFamily: "inherit" },
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
          {p.description}
        </Typography>
      </Box>
    </>
  );
}
