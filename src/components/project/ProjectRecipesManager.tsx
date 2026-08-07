"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslations } from "next-intl";
import RecipeCard from "./recipe/RecipeCard";
import { useRecipeVisibility } from "./recipe/useRecipeVisibility";

export type { ManagedRecipe } from "./recipe/RecipeCard";

export type ProjectRecipesManagerProps = {
  projectId: string;
  projectSlug: string;
  recipeNamespaces?: string[] | null;
  locale: string;
};

/**
 * プロジェクトのレシピ表示管理。
 * レシピ自体は jar 由来でCDNが持つため、ここで行えるのは公開ページに出すかどうかの切り替えのみ。
 */
const ProjectRecipesManager = (props: ProjectRecipesManagerProps) => {
  const t = useTranslations("Project.recipeManager");
  const {
    recipes,
    hidden,
    loading,
    query,
    changeQuery,
    page,
    setPage,
    totalPages,
    paginatedShown,
    busy,
    error,
    setError,
    toggle,
    toggleAll,
  } = useRecipeVisibility(props);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (recipes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">{t("empty")}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("desc")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          label={t("search")}
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => toggleAll(true)} disabled={busy}>
            {t("hideAll")}
          </Button>
          <Button variant="outlined" onClick={() => toggleAll(false)} disabled={busy}>
            {t("showAll")}
          </Button>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {t("hiddenCount", { count: hidden.size, total: recipes.length })}
      </Typography>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          mb: 3,
        }}
      >
        {paginatedShown.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            isHidden={hidden.has(recipe.id)}
            busy={busy}
            onToggle={() => toggle(recipe.id)}
            labelVisible={t("visible")}
            labelHidden={t("hidden")}
          />
        ))}
      </Box>

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination count={totalPages} page={page} onChange={(_e, p) => setPage(p)} color="primary" />
        </Box>
      )}
    </Box>
  );
};

export default ProjectRecipesManager;
