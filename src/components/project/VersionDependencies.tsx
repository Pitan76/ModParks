"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import MuiLink from "@mui/material/Link";
import ExtensionIcon from "@mui/icons-material/Extension";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { getLoaderInfo } from "@/lib/loaders";
import type { DependencyEntry, DependencyType } from "@/lib/actions/dependency";

export const DEPENDENCY_COLOR: Record<DependencyType, "error" | "success" | "warning" | "default"> = {
  required: "error",
  optional: "success",
  incompatible: "warning",
  embedded: "default",
};

type Props = {
  dependencies: DependencyEntry[];
  /** 見出しを出すか。カードの中に埋め込む場合は呼び出し側で出す */
  showTitle?: boolean;
};

/**
 * バージョン詳細で「このファイルに必要なもの」を表示する読み取り専用リスト。
 *
 * バージョン限定の依存とプロジェクト全体の依存が混ざるため、
 * 全体側にはバッジを付けて出所が分かるようにしている。
 */
export default function VersionDependencies({ dependencies, showTitle = true }: Props) {
  const t = useTranslations("Project.dependencies");

  if (dependencies.length === 0) return null;

  return (
    <Box>
      {showTitle && (
        <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary", fontWeight: 600 }}>
          {t("forVersion")}
        </Typography>
      )}
      <List dense disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {dependencies.map((dep, i) => {
          const isExternal = !!dep.externalUrl;
          return (
            <ListItem
              key={dep.id}
              divider={i !== dependencies.length - 1}
              component={isExternal ? MuiLink : Link}
              href={isExternal ? dep.externalUrl! : `/projects/${dep.project.slug}`}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
              sx={{ textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "action.hover" } }}
            >
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <Avatar src={dep.project.iconUrl || undefined} variant="rounded" sx={{ width: 32, height: 32 }}>
                  <ExtensionIcon fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {isExternal ? dep.externalName : dep.project.title}
                    {isExternal && <OpenInNewIcon fontSize="small" color="action" />}
                  </Box>
                }
              />
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                {dep.loaders.map((loader) => (
                  <Chip key={loader} size="small" variant="outlined" label={getLoaderInfo(loader).name} sx={{ height: 22 }} />
                ))}
                {!dep.versionId && (
                  <Chip size="small" variant="outlined" label={t("projectWide")} sx={{ height: 22 }} />
                )}
                <Chip
                  size="small"
                  label={t(dep.dependencyType)}
                  color={DEPENDENCY_COLOR[dep.dependencyType] || "default"}
                  sx={{ height: 22 }}
                />
              </Stack>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}
