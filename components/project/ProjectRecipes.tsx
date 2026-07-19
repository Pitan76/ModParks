import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations } from "next-intl/server";
import ProjectRecipesGrid from "./ProjectRecipesGrid";

interface ProjectRecipesProps {
  projectSlug: string;
  /** 抽出時に検出したネームスペース一覧。slug と一致しないことが多いため優先して使う */
  namespaces?: string[] | null;
}

export default async function ProjectRecipes({ projectSlug, namespaces }: ProjectRecipesProps) {
  const t = await getTranslations("Project");
  const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";

  // 保存済みネームスペースがあればそれで絞り込む。無ければ後方互換で slug を使う。
  const nsList = namespaces && namespaces.length > 0 ? namespaces : [projectSlug];
  const nsSet = new Set(nsList);

  let recipes: { id: string; url: string; title: string }[] = [];
  let error: string | null = null;

  try {
    // Fetch the index list from the CDN
    const res = await fetch(`${cdnUrl}/api/list.json`, { next: { revalidate: 60 } });
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
      .filter(id => nsSet.has(id.split(":")[0]))
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
    <ProjectRecipesGrid
      recipes={recipes}
      labels={{
        search: t("searchRecipes", { defaultValue: "レシピを検索" }),
        noMatch: t("noRecipeMatch", { defaultValue: "一致するレシピがありません。" }),
        showMore: t("showMore", { defaultValue: "もっと見る" }),
      }}
    />
  );
}
