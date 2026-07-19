"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import { useTranslations } from "next-intl";

interface ProjectRecipesProps {
  projectSlug: string;
}

export default function ProjectRecipes({ projectSlug }: ProjectRecipesProps) {
  const t = useTranslations("Project");
  const [recipes, setRecipes] = useState<{ id: string; url: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        // Using the CDN URL from config or hardcoded fallback
        const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";
        
        // Fetch the index list from the CDN
        const res = await fetch(`${cdnUrl}/api/list.json`);
        if (!res.ok) {
          throw new Error("Failed to fetch recipes list");
        }
        
        const data = await res.json() as { recipes?: { id: string }[] };
        const ids: string[] = data.recipes ? data.recipes.map(r => r.id) : [];
        
        // Filter by the project's namespace.
        // Assuming the namespace is usually similar to the project slug.
        // The items in the list are typically format "namespace:item_id"
        // Since we extract data/<namespace>/recipes/, we just search for matching namespace.
        // In this case, we use the project slug as the primary guess for the namespace.
        const matchedRecipes = ids
          .filter(id => id.startsWith(`${projectSlug}:`))
          .map(id => {
            const [namespace, itemId] = id.split(":");
            return {
              id,
              title: itemId.replace(/_/g, " "),
              url: `${cdnUrl}/api/${namespace}/${itemId}.png`
            };
          });
          
        if (mounted) {
          setRecipes(matchedRecipes);
          setError(null);
        }
      } catch (err: any) {
        console.error(err);
        if (mounted) {
          setError(err.message || "Failed to load recipes");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchRecipes();
    return () => {
      mounted = false;
    };
  }, [projectSlug]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  if (recipes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">{t("noRecipes", { defaultValue: "レシピが見つかりません。" })}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      <ImageList variant="masonry" cols={3} gap={16}>
        {recipes.map((recipe) => (
          <ImageListItem key={recipe.id} sx={{ backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 1, overflow: "hidden", p: 2 }}>
            <img
              src={recipe.url}
              alt={recipe.title}
              loading="lazy"
              style={{ objectFit: "contain", width: "100%", height: "auto" }}
            />
            <ImageListItemBar
              title={recipe.title}
              position="below"
              sx={{ textAlign: "center" }}
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
}
