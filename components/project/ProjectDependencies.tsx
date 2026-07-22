"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import { Link } from "@/i18n/routing";
import MuiLink from "@mui/material/Link";
import ExtensionIcon from "@mui/icons-material/Extension";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

type DependencyProject = {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
};

type ProjectDependenciesProps = {
  dependencies: {
    id: string;
    dependencyType: "required" | "optional" | "incompatible" | "embedded";
    project: DependencyProject;
    externalUrl?: string | null;
    externalName?: string | null;
  }[];
  dependents: {
    id: string;
    dependencyType: "required" | "optional" | "incompatible" | "embedded";
    project: DependencyProject;
  }[];
};

const DEP_COLOR: Record<string, "error" | "success" | "warning" | "default"> = {
  required: "error",
  optional: "success",
  incompatible: "warning",
  embedded: "default",
};

/**
 * プロジェクトの依存関係（前提モジュールや互換性のないモジュール）および
 * 被依存関係（このプロジェクトに依存している他のプロジェクト）を一覧表示するコンポーネント。
 */
const ProjectDependencies = ({ dependencies, dependents }: ProjectDependenciesProps) => {
  const t = useTranslations("Project");

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {t("dependencies.current")}
      </Typography>
      
      {dependencies.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 4 }}>{t("dependencies.noDependencies")}</Typography>
      ) : (
        <List sx={{ mb: 4, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
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
                sx={{ textDecoration: "none", color: "inherit", '&:hover': { bgcolor: "action.hover" } }}
              >
                <ListItemAvatar>
                  <Avatar src={dep.project.iconUrl || undefined} variant="rounded">
                    <ExtensionIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText 
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {isExternal ? dep.externalName : dep.project.name}
                      {isExternal && <OpenInNewIcon fontSize="small" color="action" />}
                    </Box>
                  }
                />
                <Chip size="small" label={t(`dependencies.${dep.dependencyType}`)} color={DEP_COLOR[dep.dependencyType] || "default"} />
              </ListItem>
            );
          })}
        </List>
      )}

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {t("dependencies.dependents")}
      </Typography>
      
      {dependents.length === 0 ? (
        <Typography color="text.secondary">{t("dependencies.noDependents")}</Typography>
      ) : (
        <List sx={{ bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          {dependents.map((dep, i) => (
            <ListItem 
              key={dep.id}
              divider={i !== dependents.length - 1}
              component={Link}
              href={`/projects/${dep.project.slug}`}
              sx={{ textDecoration: "none", color: "inherit", '&:hover': { bgcolor: "action.hover" } }}
            >
              <ListItemAvatar>
                <Avatar src={dep.project.iconUrl || undefined} variant="rounded">
                  <ExtensionIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText 
                primary={dep.project.name}
              />
              <Chip size="small" label={t(`dependencies.${dep.dependencyType}`)} color={DEP_COLOR[dep.dependencyType] || "default"} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default ProjectDependencies;
