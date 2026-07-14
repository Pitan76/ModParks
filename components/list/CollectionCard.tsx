"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import { Link as RoutingLink } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    description: string | null;
    visibility: "public" | "unlisted" | "private";
    iconUrl?: string | null;
  };
}

export default function CollectionCard({ collection }: CollectionCardProps) {
  const tCommon = useTranslations("Common");

  return (
    <RoutingLink href={`/lists/${collection.id}`} prefetch={false} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      <Box
        sx={{
          p: 2.5,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          transition: "all 0.2s",
          display: "flex",
          gap: 2,
          alignItems: "flex-start",
          height: "100%",
          "&:hover": {
            borderColor: "primary.main",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            transform: "translateY(-2px)",
          },
        }}
      >
        {collection.iconUrl ? (
          <Avatar src={collection.iconUrl} variant="rounded" sx={{ width: 56, height: 56, boxShadow: 1 }} />
        ) : (
          <Avatar variant="rounded" sx={{ width: 56, height: 56, bgcolor: "action.hover", color: "text.secondary" }}>
            {collection.name[0]?.toUpperCase()}
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5, gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {collection.name}
            </Typography>
            <Chip 
              label={tCommon(`visibility.${collection.visibility}`)}
              size="small"
              variant="outlined"
              color={collection.visibility === "public" ? "primary" : "default"}
              sx={{ flexShrink: 0, height: 20, fontSize: "0.7rem" }}
            />
          </Box>
          {collection.description && (
            <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", mt: 0.5 }}>
              {collection.description}
            </Typography>
          )}
        </Box>
      </Box>
    </RoutingLink>
  );
}
