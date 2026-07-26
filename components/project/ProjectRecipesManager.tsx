"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useTranslations } from "next-intl";
import { setRecipeHiddenAction, setRecipesHiddenAction } from "@/lib/actions/projectRecipe";

/** 編集画面に並べる1レシピ。名前と画像URLはレシピCDNの索引から来る。 */
export type ManagedRecipe = {
  id: string;
  name: string;
  url: string;
};

export type ProjectRecipesManagerProps = {
  projectSlug: string;
  recipes: ManagedRecipe[];
  hiddenIds: string[];
};

/**
 * プロジェクトのレシピ表示管理。
 * レシピ自体は jar 由来でCDNが持つため、ここで行えるのは公開ページに出すかどうかの切り替えのみ。
 */
const ProjectRecipesManager = ({ projectSlug, recipes, hiddenIds }: ProjectRecipesManagerProps) => {
  const t = useTranslations("Project.recipeManager");
  const [hidden, setHidden] = useState<Set<string>>(new Set(hiddenIds));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [recipes, query]);

  /** 1件の表示・非表示を切り替える。失敗したら元の状態に戻す。 */
  const toggle = async (id: string) => {
    const next = !hidden.has(id);
    applyLocal([id], next);

    setBusy(true);
    setError(null);
    const res = await setRecipeHiddenAction(projectSlug, id, next);
    setBusy(false);

    if (res.error) {
      applyLocal([id], !next);
      setError(res.error);
    }
  };

  /** 現在絞り込まれている分をまとめて切り替える。 */
  const toggleAll = async (next: boolean) => {
    const ids = shown.map((r) => r.id);
    const previous = new Set(hidden);
    applyLocal(ids, next);

    setBusy(true);
    setError(null);
    const res = await setRecipesHiddenAction(projectSlug, ids, next);
    setBusy(false);

    if (res.error) {
      setHidden(previous);
      setError(res.error);
    }
  };

  const applyLocal = (ids: string[], isHidden: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (isHidden) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

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
          onChange={(e) => setQuery(e.target.value)}
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
        }}
      >
        {shown.map((recipe) => {
          const isHidden = hidden.has(recipe.id);
          return (
            <Box
              key={recipe.id}
              sx={{
                p: 1,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                opacity: isHidden ? 0.45 : 1,
              }}
            >
              {/* レシピ画像はCDNが生成した固定サイズのPNG。next/image を通す利点がないため img で出す */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.url}
                alt={recipe.name}
                loading="lazy"
                style={{ width: "100%", height: "auto", imageRendering: "pixelated" }}
              />
              <Typography variant="body2" noWrap title={recipe.name} sx={{ mt: 0.5 }}>
                {recipe.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap title={recipe.id} sx={{ display: "block" }}>
                {recipe.id}
              </Typography>
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="caption" color="text.secondary">
                  {isHidden ? t("hidden") : t("visible")}
                </Typography>
                <Switch
                  size="small"
                  checked={!isHidden}
                  onChange={() => toggle(recipe.id)}
                  disabled={busy}
                  slotProps={{ input: { "aria-label": recipe.name } }}
                />
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ProjectRecipesManager;
