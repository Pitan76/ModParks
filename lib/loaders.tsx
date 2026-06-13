import React from "react";
import Box from "@mui/material/Box";

export interface LoaderInfo {
  id: string;
  name: string;
  color: "default" | "primary" | "secondary" | "warning" | "error" | "info" | "success";
  icon?: React.ReactElement;
}

export const LOADERS_MAP: Record<string, LoaderInfo> = {
  fabric: {
    id: "fabric",
    name: "Fabric",
    color: "primary",
    icon: <Box component="img" src="/icons/loaders/fabric.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  forge: {
    id: "forge",
    name: "Forge",
    color: "warning",
    icon: <Box component="img" src="/icons/loaders/forge.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  neoforge: {
    id: "neoforge",
    name: "NeoForge",
    color: "warning",
    icon: <Box component="img" src="/icons/loaders/neoforge.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  quilt: {
    id: "quilt",
    name: "Quilt",
    color: "secondary",
    icon: <Box component="img" src="/icons/loaders/quilt.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  paper: {
    id: "paper",
    name: "Paper",
    color: "default",
    icon: <Box component="img" src="/icons/loaders/paper.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  purpur: {
    id: "purpur",
    name: "Purpur",
    color: "default",
    icon: <Box component="img" src="/icons/loaders/purpur.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  velocity: {
    id: "velocity",
    name: "Velocity",
    color: "info",
    icon: <Box component="img" src="/icons/loaders/velocity.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
  waterfall: {
    id: "waterfall",
    name: "Waterfall",
    color: "info",
    icon: <Box component="img" src="/icons/loaders/waterfall.png" sx={{ width: 18, height: 18, objectFit: "contain", borderRadius: "2px" }} />,
  },
};

export const AVAILABLE_LOADERS = Object.keys(LOADERS_MAP);

export const getLoaderInfo = (id: string): LoaderInfo => {
  const normalizedId = id.toLowerCase();
  return LOADERS_MAP[normalizedId] || { 
    id, 
    name: id.charAt(0).toUpperCase() + id.slice(1), 
    color: "default", 
    icon: <Box sx={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", bgcolor: "divider", borderRadius: "2px" }}>{id.charAt(0).toUpperCase()}</Box>
  };
};
