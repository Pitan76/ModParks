import React from "react";
import Avatar from "@mui/material/Avatar";

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
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#DCC39A", color: "#3e3e3e" }}>Fa</Avatar>,
  },
  forge: {
    id: "forge",
    name: "Forge",
    color: "warning",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#dfa86a", color: "#fff" }}>Fo</Avatar>,
  },
  neoforge: {
    id: "neoforge",
    name: "NeoForge",
    color: "warning",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#e27837", color: "#fff" }}>N</Avatar>,
  },
  quilt: {
    id: "quilt",
    name: "Quilt",
    color: "secondary",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#8f56ba", color: "#fff" }}>Q</Avatar>,
  },
  paper: {
    id: "paper",
    name: "Paper",
    color: "default",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#f1f1f1", color: "#333" }}>Pa</Avatar>,
  },
  purpur: {
    id: "purpur",
    name: "Purpur",
    color: "default",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#d7b2d5", color: "#fff" }}>Pu</Avatar>,
  },
  velocity: {
    id: "velocity",
    name: "Velocity",
    color: "info",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#008df4", color: "#fff" }}>V</Avatar>,
  },
  waterfall: {
    id: "waterfall",
    name: "Waterfall",
    color: "info",
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12, bgcolor: "#009688", color: "#fff" }}>W</Avatar>,
  },
};

export const AVAILABLE_LOADERS = Object.keys(LOADERS_MAP);

export const getLoaderInfo = (id: string): LoaderInfo => {
  const normalizedId = id.toLowerCase();
  return LOADERS_MAP[normalizedId] || { 
    id, 
    name: id.charAt(0).toUpperCase() + id.slice(1), 
    color: "default", 
    icon: <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>{id.charAt(0).toUpperCase()}</Avatar> 
  };
};
