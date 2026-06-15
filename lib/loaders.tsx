import React from "react";
import Box from "@mui/material/Box";
import Image from "next/image";

/** ローダーアイコンの共通スタイル */
const LOADER_ICON_STYLE = { objectFit: "contain" as const, borderRadius: "2px" };
const LOADER_ICON_SIZE = 18;

const LoaderIcon = React.forwardRef<HTMLSpanElement, any>(
  ({ name, className, style, ...props }, ref) => {
    return (
      <Box component="span" className={className} sx={{ display: "flex", ...style }} ref={ref} {...props}>
        <Image
          src={`/icons/loaders/${name}.png`}
          alt={name.charAt(0).toUpperCase() + name.slice(1)}
          width={LOADER_ICON_SIZE}
          height={LOADER_ICON_SIZE}
          style={LOADER_ICON_STYLE}
          unoptimized
        />
      </Box>
    );
  }
);
LoaderIcon.displayName = "LoaderIcon";

export interface LoaderInfo {
  id: string;
  name: string;
  color: "default" | "primary" | "secondary" | "warning" | "error" | "info" | "success";
  icon?: React.ReactElement;
}

/** ローダー定義データ（アイコンは遅延生成） */
const LOADERS_DATA: { id: string; name: string; color: LoaderInfo["color"] }[] = [
  { id: "fabric",    name: "Fabric",    color: "primary"   },
  { id: "forge",     name: "Forge",     color: "warning"   },
  { id: "neoforge",  name: "NeoForge",  color: "warning"   },
  { id: "quilt",     name: "Quilt",     color: "secondary" },
  { id: "spigot",    name: "Spigot",    color: "default"   },
  { id: "paper",     name: "Paper",     color: "default"   },
  { id: "purpur",    name: "Purpur",    color: "default"   },
  { id: "velocity",  name: "Velocity",  color: "info"      },
  { id: "waterfall", name: "Waterfall", color: "info"      },
];

export const LOADERS_MAP: Record<string, LoaderInfo> = Object.fromEntries(
  LOADERS_DATA.map(({ id, name, color }) => [
    id,
    { id, name, color, icon: <LoaderIcon name={id} /> },
  ])
);

export const AVAILABLE_LOADERS = Object.keys(LOADERS_MAP);

export const getLoaderInfo = (id: string): LoaderInfo => {
  const normalizedId = id.toLowerCase();
  return LOADERS_MAP[normalizedId] || { 
    id, 
    name: id.charAt(0).toUpperCase() + id.slice(1), 
    color: "default", 
    icon: <Box sx={{ width: LOADER_ICON_SIZE, height: LOADER_ICON_SIZE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", bgcolor: "divider", borderRadius: "2px" }}>{id.charAt(0).toUpperCase()}</Box>
  };
};
