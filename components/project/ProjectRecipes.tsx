import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations, getLocale } from "next-intl/server";
import ProjectRecipesGrid from "./ProjectRecipesGrid";
import { fetchItemNames } from "@/lib/services/itemNames";

type ProjectRecipesProps = {
  projectSlug: string;
  namespaces?: string[] | null;
};

/**
 * プロジェクトのレシピ一覧を取得・描画するサーバーコンポーネント。
 * CDNからレシピのリストを取得し、ネームスペースでフィルタリングしてグリッド表示します。
 */
const ProjectRecipes = async ({ projectSlug, namespaces }: ProjectRecipesProps) => {
  const t = await getTranslations("Project");
  const locale = await getLocale();
  const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";

  // 保存済みネームスペースがあればそれで絞り込む。無ければ後方互換で slug を使う。
  const nsList = namespaces && namespaces.length > 0 ? namespaces : [projectSlug];
  const nsSet = new Set(nsList);

  let recipes: { id: string; url: string; title: string }[] = [];
  let error: string | null = null;

  try {
    const res = await fetch(`${cdnUrl}/api/list.json`, { next: { revalidate: 60 } });
    if (!res.ok) {
      throw new Error("Failed to fetch recipes list");
    }
    
    const data = await res.json() as {
      recipes?: { id: string; result?: string | null }[];
      versions?: Record<string, string>;
    };
    const entries = (data.recipes ?? []).filter(r => nsSet.has(r.id.split(":")[0]));

    // レシピIDではなく完成品のアイテムIDに対して名前を引く。
    const names = await fetchItemNames(
      cdnUrl,
      entries.map(r => r.result).filter((r): r is string => !!r),
      locale
    );

    recipes = entries.map(({ id, result }) => {
      const [namespace, itemId] = id.split(":");
      // URL にアセットバージョンを埋めると CDN 側がバージョン参照の R2 往復を省略でき、
      // レスポンスが immutable になるため再訪時はネットワークに出なくなる。
      const v = data.versions?.[namespace];
      return {
        id,
        // 名前が未翻訳のアイテムはIDから読める形を作って出す。
        title: (result && names[result]) || itemId.replace(/_/g, " "),
        url: `${cdnUrl}/api/${namespace}/${itemId}.png${v ? `?v=${encodeURIComponent(v)}` : ""}`
      };
    });
  } catch (err: unknown) {
    console.error("Failed to fetch recipes:", err);
    error = err instanceof Error ? err.message : "Failed to load recipes";
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
        <Typography color="text.secondary">{t("noRecipes")}</Typography>
      </Box>
    );
  }

  return (
    <ProjectRecipesGrid
      recipes={recipes}
      labels={{
        search: t("searchRecipes"),
        noMatch: t("noRecipeMatch"),
        showMore: t("showMore"),
      }}
    />
  );
};

export default ProjectRecipes;
