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
import ExtensionIcon from "@mui/icons-material/Extension";

interface DependencyProject {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
}

interface ProjectDependenciesProps {
  dependencies: {
    id: string;
    dependencyType: "required" | "optional" | "incompatible" | "embedded";
    project: DependencyProject;
  }[];
  dependents: {
    id: string;
    dependencyType: "required" | "optional" | "incompatible" | "embedded";
    project: DependencyProject;
  }[];
}

export default function ProjectDependencies({ dependencies, dependents }: ProjectDependenciesProps) {
  const t = useTranslations("Project");

  const getDepColor = (type: string) => {
    switch(type) {
      case "required": return "error";
      case "optional": return "success";
      case "incompatible": return "warning";
      case "embedded": return "default";
      default: return "default";
    }
  };

  const getDepLabel = (type: string) => {
    switch(type) {
      case "required": return "Required";
      case "optional": return "Optional";
      case "incompatible": return "Incompatible";
      case "embedded": return "Embedded";
      default: return type;
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {t("dependencies.current")}
      </Typography>
      
      {dependencies.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 4 }}>{t("dependencies.noDependencies")}</Typography>
      ) : (
        <List sx={{ mb: 4, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          {dependencies.map((dep, i) => (
            <ListItem 
              key={dep.id}
              divider={i !== dependencies.length - 1}
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
              <Chip size="small" label={t(`dependencies.${dep.dependencyType}`)} color={getDepColor(dep.dependencyType) as any} />
            </ListItem>
          ))}
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
              <Chip size="small" label={t(`dependencies.${dep.dependencyType}`)} color={getDepColor(dep.dependencyType) as any} />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
