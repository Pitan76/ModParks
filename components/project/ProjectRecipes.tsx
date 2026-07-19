import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ImageList from "@mui/material/ImageList";
import ImageListItem from "@mui/material/ImageListItem";
import ImageListItemBar from "@mui/material/ImageListItemBar";
import { getTranslations } from "next-intl/server";

interface ProjectRecipesProps {
  projectSlug: string;
}

export default async function ProjectRecipes({ projectSlug }: ProjectRecipesProps) {
  const t = await getTranslations("Project");
  const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";

  let recipes: { id: string; url: string; title: string }[] = [];
  let error: string | null = null;

  try {
    // Fetch the index list from the CDN
    const res = await fetch(`${cdnUrl}/api/list.json`, { next: { revalidate: 3600 } });
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
    recipes = ids
      .filter(id => id.startsWith(`${projectSlug}:`))
      .map(id => {
        const [namespace, itemId] = id.split(":");
        return {
          id,
          title: itemId.replace(/_/g, " "),
          url: `${cdnUrl}/api/${namespace}/${itemId}.png`
        };
      });
  } catch (err: any) {
    console.error("Failed to fetch recipes:", err);
    error = err.message || "Failed to load recipes";
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
