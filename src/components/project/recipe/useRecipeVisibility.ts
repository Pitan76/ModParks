"use client";

import { useMemo, useState, useEffect } from "react";
import {
  setRecipeHiddenAction,
  setRecipesHiddenAction,
  getHiddenRecipeIdsAction,
  getProjectRecipesAction,
} from "@/lib/actions/projectRecipe";
import type { ManagedRecipe } from "./RecipeCard";

const PAGE_SIZE = 24;

export type UseRecipeVisibilityParams = {
  projectId: string;
  projectSlug: string;
  recipeNamespaces?: string[] | null;
  locale: string;
};

/**
 * レシピの表示・非表示の状態管理。
 *
 * 切り替えは先に画面へ反映してからサーバへ送り、失敗したら元に戻す。
 * 一覧が数百件になるため、往復を待ってから描画すると操作感が悪くなるため。
 */
export function useRecipeVisibility({
  projectId,
  projectSlug,
  recipeNamespaces,
  locale,
}: UseRecipeVisibilityParams) {
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
        if (recipesRes.error) throw new Error(recipesRes.error);
        if (hiddenRes.error) throw new Error(hiddenRes.error);

        setRecipes(recipesRes.recipes || []);
        setHidden(new Set(hiddenRes.hiddenIds || []));
      } catch (err: unknown) {
        if (isMounted) setError(err instanceof Error ? err.message : "Failed to load recipes");
      } finally {
        if (isMounted) setLoading(false);
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
  const paginatedShown = useMemo(
    () => shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [shown, page],
  );

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

  const changeQuery = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return {
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
  };
}
