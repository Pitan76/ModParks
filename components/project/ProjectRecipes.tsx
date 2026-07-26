import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations, getLocale } from "next-intl/server";
import ProjectRecipesGrid from "./ProjectRecipesGrid";
import { fetchRecipeLists, toRecipeItems } from "@/lib/services/recipeList";
import { getHiddenRecipeIds } from "@/lib/queries/hiddenRecipes";

type ProjectRecipesProps = {
  projectId: string;
  projectSlug: string;
  namespaces?: string[] | null;
};

/**
 * プロジェクトのレシピ一覧を取得・描画するサーバーコンポーネント。
 * CDNからこのプロジェクトのネームスペース分だけの索引を取得し、グリッド表示します。
 */
const ProjectRecipes = async ({ projectId, projectSlug, namespaces }: ProjectRecipesProps) => {
  const t = await getTranslations("Project");
  const locale = await getLocale();
  const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";

  // 保存済みネームスペースがあればそれで絞り込む。無ければ後方互換で slug を使う。
  const nsList = namespaces && namespaces.length > 0 ? namespaces : [projectSlug];

  // ネームスペース単位の索引はアイテム名まで同梱されて返るため、これ1回で一覧が組める。
  const [lists, hiddenIds] = await Promise.all([
    fetchRecipeLists(cdnUrl, nsList, locale),
    getHiddenRecipeIds(projectId),
  ]);

  // レシピが0件でも索引自体は返るため、1つも取れないのは取得失敗を意味する。
  const error = lists.length === 0 ? t("recipesUnavailable") : null;

  // 非表示指定はCDNではなくmodparks側が持つため、描画直前にここで落とす。
  const recipes = toRecipeItems(cdnUrl, lists)
    .filter((r) => !hiddenIds.has(r.id))
    .map(({ id, name, url }) => ({ id, title: name, url }));

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
