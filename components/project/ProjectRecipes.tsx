import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { getTranslations, getLocale } from "next-intl/server";
import ProjectRecipesGrid from "./ProjectRecipesGrid";
import { fetchRecipeLists } from "@/lib/services/recipeList";

type ProjectRecipesProps = {
  projectSlug: string;
  namespaces?: string[] | null;
};

/**
 * プロジェクトのレシピ一覧を取得・描画するサーバーコンポーネント。
 * CDNからこのプロジェクトのネームスペース分だけの索引を取得し、グリッド表示します。
 */
const ProjectRecipes = async ({ projectSlug, namespaces }: ProjectRecipesProps) => {
  const t = await getTranslations("Project");
  const locale = await getLocale();
  const cdnUrl = process.env.NEXT_PUBLIC_RECIPE_CDN_URL || "https://recipe.modparks.pitan76.net";

  // 保存済みネームスペースがあればそれで絞り込む。無ければ後方互換で slug を使う。
  const nsList = namespaces && namespaces.length > 0 ? namespaces : [projectSlug];

  // ネームスペース単位の索引はアイテム名まで同梱されて返るため、これ1回で一覧が組める。
  const lists = await fetchRecipeLists(cdnUrl, nsList, locale);

  // レシピが0件でも索引自体は返るため、1つも取れないのは取得失敗を意味する。
  const error = lists.length === 0 ? t("recipesUnavailable") : null;

  const recipes = lists.flatMap(({ version, recipes: entries }) =>
    entries.map(({ id, name }) => {
      const [namespace, itemId] = id.split(":");
      // URL にアセットバージョンを埋めると CDN 側がバージョン参照の R2 往復を省略でき、
      // レスポンスが immutable になるため再訪時はネットワークに出なくなる。
      // 未設定を意味する "0" のときに付けると、まだ何も入っていない画像を1年間焼き付けてしまう。
      const pin = version && version !== "0" ? `?v=${encodeURIComponent(version)}` : "";
      return { id, title: name, url: `${cdnUrl}/api/${namespace}/${itemId}.png${pin}` };
    })
  );

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
