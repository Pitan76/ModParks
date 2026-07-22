import React from "react";
import Box from "@mui/material/Box";
import Image from "next/image";
import { LOADERS_DATA, AVAILABLE_LOADERS, type LoaderColor } from "@/lib/data/loaderIds";

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
  color: LoaderColor;
  icon?: React.ReactElement;
}

export const LOADERS_MAP: Record<string, LoaderInfo> = Object.fromEntries(
  LOADERS_DATA.map(({ id, name, color }) => [
    id,
    { id, name, color, icon: <LoaderIcon name={id} /> },
  ])
);

export { AVAILABLE_LOADERS };

export const getLoaderInfo = (id: string): LoaderInfo => {
  const normalizedId = id.toLowerCase();
  return LOADERS_MAP[normalizedId] || { 
    id, 
    name: id.charAt(0).toUpperCase() + id.slice(1), 
    color: "default", 
    icon: <Box sx={{ width: LOADER_ICON_SIZE, height: LOADER_ICON_SIZE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: "bold", bgcolor: "divider", borderRadius: "2px" }}>{id.charAt(0).toUpperCase()}</Box>
  };
};
