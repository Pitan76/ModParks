"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import GitHubIcon from "@mui/icons-material/GitHub";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import GavelIcon from "@mui/icons-material/Gavel";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import XIcon from "@mui/icons-material/X";
import YouTubeIcon from "@mui/icons-material/YouTube";
import LanguageIcon from "@mui/icons-material/Language";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import { useTranslations } from "next-intl";
import ReportDialog from "@/components/project/ReportDialog";
import { Link } from "@/lib/i18n/routing";
import { parseLinks } from "@/lib/utils/links";
import { toProxiedImageUrl } from "@/lib/utils/imageProxy";
import { useColorMode } from "@/components/ThemeRegistry";
import PlainProjectSidebar from "@/components/plain/project/PlainProjectSidebar";
import { summarizeProjectVersions, type SummarizableVersion } from "@/lib/utils/projectVersionSummary";
import { getLoaderInfo } from "@/lib/loaders";
import { useState, useEffect } from "react";

export type ProjectSidebarProps = {
  /** 対象プロジェクトの情報 */
  project: {
    id: string;
    license: string;
    sourceUrl?: string | null;
    links?: string | null;
    tags: string[];
    versions: SummarizableVersion[];
    aiGenerated?: boolean;
  };
  /** ログイン済みか (通報ボタンの表示判定用) */
  isAuthenticated: boolean;
};

const getLinkIcon = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("discord.com") || hostname.includes("discord.gg")) return <img src="/discord-icon.svg" alt="Discord" style={{ width: 20, height: 20 }} />;
    if (hostname.includes("x.com") || hostname.includes("twitter.com")) return <XIcon />;
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return <YouTubeIcon color="error" />;
    if (hostname.includes("github.com")) return <GitHubIcon />;
    if (hostname.includes("modrinth.com")) return <img src={toProxiedImageUrl("https://modrinth.com/favicon.ico")} alt="Modrinth" style={{ width: 16, height: 16 }} />;
    if (hostname.includes("curseforge.com")) return <img src={toProxiedImageUrl("https://www.curseforge.com/favicon.ico")} alt="CurseForge" style={{ width: 16, height: 16 }} />;
  } catch {
    // 無効なURLなどの場合はフォールバックアイコンへ移行
  }
  return <LanguageIcon />;
};

/**
 * プロジェクト詳細ページのサイドバーコンポーネント。
 * ライセンス、ソースコード、カスタム外部リンク、関連タグ、及び通報ダイアログへの導線を表示します。
 */
const ProjectSidebar = ({ project: p, isAuthenticated }: ProjectSidebarProps) => {
  const t = useTranslations("Project");
  const tTags = useTranslations("Tags");
  const { isPlainTheme } = useColorMode();
  const [showAiLabel, setShowAiLabel] = useState(true);

  useEffect(() => {
    try {
      const val = window.localStorage.getItem("show_ai_label");
      if (val === "false") {
        setShowAiLabel(false);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  if (isPlainTheme) return <PlainProjectSidebar project={p} isAuthenticated={isAuthenticated} />;

  const getTagLabel = (tag: string) => {
    const key = tag.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return tTags.has(key) ? tTags(key) : tag;
  };

  const { mcVersions, loaders } = summarizeProjectVersions(p.versions);

  return (
    <Box
      sx={{
        bgcolor:      "background.paper",
        border:       "1px solid",
        borderColor:  "divider",
        borderRadius: 2,
        p:            2.5,
        // 追従は広告枠を含む親側で行う（ここで sticky にすると広告と重なる）
      }}
    >
      {/* 対応ローダー */}
      {loaders.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {t("infobox.platforms")}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {loaders.map((loader) => {
              const info = getLoaderInfo(loader);
              return <Chip key={loader} label={info.name} size="small" color={info.color} icon={info.icon} />;
            })}
          </Stack>
        </Box>
      )}

      {/* 対応MCバージョン */}
      {mcVersions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            {t("infobox.gameVersions")}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {mcVersions.map((mc) => (
              <Chip key={mc} label={mc} size="small" variant="outlined" sx={{ borderColor: "divider", color: "text.secondary" }} />
            ))}
          </Stack>
        </Box>
      )}

      {(loaders.length > 0 || mcVersions.length > 0) && <Divider sx={{ mb: 2 }} />}

      {/* AI生成コンテンツ */}
      {showAiLabel && p.aiGenerated && (
        <>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <SmartToyIcon fontSize="small" color="action" />
              {t("infobox.aiGenerated")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("infobox.aiGeneratedDesc")}
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
        </>
      )}

      {/* ライセンス */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <GavelIcon fontSize="small" color="action" />
          {t("infobox.license")}
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
            {t("infobox.sourceCode")}
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
            sx={{ justifyContent: "flex-start", color: "text.primary", borderColor: "divider" }}
          >
            GitHub
          </Button>
        </Box>
      )}

      {/* カスタムリンク */}
      {(() => {
        const links = parseLinks(p.links);
        if (links.length === 0) return null;
        
        return (
          <Box sx={{ mb: 2, mt: p.sourceUrl ? 2 : 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <LinkIcon fontSize="small" color="action" />
              {t("fields.linksSection")}
            </Typography>
            <Stack spacing={1}>
              {links.map((l, idx) => (
                <Button
                  key={idx}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={getLinkIcon(l.url)}
                  fullWidth
                  variant="outlined"
                  size="small"
                  sx={{ justifyContent: "flex-start", color: "text.primary", borderColor: "divider" }}
                >
                  {l.title}
                </Button>
              ))}
            </Stack>
          </Box>
        );
      })()}

      {/* タグ */}
      {p.tags.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <LocalOfferIcon fontSize="small" color="action" />
            {t("infobox.tags")}
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {p.tags.map((tag) => (
              <Link key={tag} href={`/projects?tags=${encodeURIComponent(tag)}`} prefetch={false} style={{ textDecoration: "none" }}>
                <Chip
                  label={getTagLabel(tag)}
                  size="small"
                  variant="outlined"
                  clickable
                  sx={{ borderColor: "divider", color: "text.secondary", cursor: "pointer" }}
                />
              </Link>
            ))}
          </Stack>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* 通報 */}
      {isAuthenticated && (
        <ReportDialog targetType="project" targetId={p.id} />
      )}
    </Box>
  );
};

export default ProjectSidebar;
