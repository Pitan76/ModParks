"use client";

import { useMemo, useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Pagination from "@mui/material/Pagination";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslations } from "next-intl";
import {
  setRecipeHiddenAction,
  setRecipesHiddenAction,
  getHiddenRecipeIdsAction,
  getProjectRecipesAction,
} from "@/lib/actions/projectRecipe";

/** 編集画面に並べる1レシピ。名前と画像URLはレシピCDNの索引から来る。 */
export type ManagedRecipe = {
  id: string;
  name: string;
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
};

export type ProjectRecipesManagerProps = {
  projectId: string;
  projectSlug: string;
  recipeNamespaces?: string[] | null;
  locale: string;
};

type RecipeCardProps = {
  recipe: ManagedRecipe;
  isHidden: boolean;
  busy: boolean;
  onToggle: () => void;
  labelVisible: string;
  labelHidden: string;
};

const RecipeCard = ({ recipe, isHidden, busy, onToggle, labelVisible, labelHidden }: RecipeCardProps) => {
  // R2から直接取る URL は未生成の画像だと404になる。そのときだけCDNのWorkerに生成させる。
  const [failed, setFailed] = useState(false);

  return (
    <Box
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
        src={failed ? recipe.fallbackUrl : recipe.url}
        alt={recipe.name}
        loading="lazy"
        onError={() => setFailed(true)}
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
          {isHidden ? labelHidden : labelVisible}
        </Typography>
        <Switch
          size="small"
          checked={!isHidden}
          onChange={onToggle}
          disabled={busy}
          slotProps={{ input: { "aria-label": recipe.name } }}
        />
      </Stack>
    </Box>
  );
};

const PAGE_SIZE = 24;

/**
 * プロジェクトのレシピ表示管理。
 * レシピ自体は jar 由来でCDNが持つため、ここで行えるのは公開ページに出すかどうかの切り替えのみ。
 */
const ProjectRecipesManager = ({
  projectId,
  projectSlug,
  recipeNamespaces,
  locale,
}: ProjectRecipesManagerProps) => {
  const t = useTranslations("Project.recipeManager");
  const [recipes, setRecipes] = useState<ManagedRecipe[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // マウント時にサーバーアクション経由でレシピ一覧と非表示設定をロードする（CORS回避のため）
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [recipesRes, hiddenRes] = await Promise.all([
          getProjectRecipesAction(recipeNamespaces, projectSlug, locale),
          getHiddenRecipeIdsAction(projectId),
        ]);

        if (!isMounted) return;

        if (recipesRes.error) {
          throw new Error(recipesRes.error);
        }
        if (hiddenRes.error) {
          throw new Error(hiddenRes.error);
        }

        setRecipes(recipesRes.recipes || []);
        setHidden(new Set(hiddenRes.hiddenIds || []));
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load recipes");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [projectId, projectSlug, recipeNamespaces, locale]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }, [recipes, query]);

  const totalPages = Math.ceil(shown.length / PAGE_SIZE);

  // 1ページ分のレシピのみを切り出してDOM描画の負荷を抑える
  const paginatedShown = useMemo(() => {
    return shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [shown, page]);

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
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
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
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default ProjectRecipesManager;
