"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  reindexRecipesAction,
  purgeRecipeCacheAction,
  sweepIngestsAction,
  cleanNamespaceFolderAction,
  seedAssetVersionsAction,
  listR2ObjectsAction,
  render3dIconAction,
} from "@/lib/actions/adminRecipe";

export type LogEntry = {
  time: string;
  type: "success" | "error" | "info";
  message: string;
  details?: any;
};

type ActionResult = { success?: boolean; data?: any; error?: string };

/** レシピ管理画面の状態とサーバーアクション実行ロジックを集約する。 */
export function useRecipeAdmin() {
  const t = useTranslations("Admin.recipe");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [purgeNamespace, setPurgeNamespace] = useState("");
  const [cleanNamespace, setCleanNamespace] = useState("");
  const [cleanFolder, setCleanFolder] = useState("");

  const [lsPrefix, setLsPrefix] = useState("");
  const [lsLimit, setLsLimit] = useState<number>(200);
  const [renderNamespace, setRenderNamespace] = useState("");
  const [renderPath, setRenderPath] = useState("");
  const [renderFormat, setRenderFormat] = useState<"png" | "svg">("png");
  const [previewImage, setPreviewImage] = useState<{ format: "png" | "svg"; data: string } | null>(null);

  const addLog = (type: LogEntry["type"], message: string, details?: any) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), type, message, details }, ...prev]);
  };

  const handleAction = async (actionName: string, actionPromise: Promise<ActionResult>) => {
    setLoading(true);
    addLog("info", `${actionName} ${t("loading")}`);
    try {
      const res = await actionPromise;
      if (res.error) addLog("error", `${actionName} ${t("error")}: ${res.error}`);
      else addLog("success", `${actionName} ${t("success")}`, res.data);
    } catch (err: any) {
      addLog("error", `${actionName} ${t("error")}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runReindex = () => handleAction(t("reindex.title"), reindexRecipesAction());
  const runSweep = () => handleAction(t("sweep.title"), sweepIngestsAction());
  const runSeed = () => handleAction(t("seed.title"), seedAssetVersionsAction());

  const runPurge = () => {
    if (!purgeNamespace) return;
    handleAction(`${t("purge.title")} (${purgeNamespace})`, purgeRecipeCacheAction(purgeNamespace));
  };

  const runClean = () => {
    if (!cleanNamespace || !cleanFolder) return;
    handleAction(
      `${t("clean.title")} (${cleanNamespace}/${cleanFolder})`,
      cleanNamespaceFolderAction(cleanNamespace, cleanFolder)
    );
  };

  const runLs = () => {
    handleAction(
      `${t("ls.title")} (prefix: ${lsPrefix || "(none)"}, limit: ${lsLimit})`,
      listR2ObjectsAction(lsPrefix || undefined, lsLimit)
    );
  };

  const runRender3d = async () => {
    if (!renderNamespace || !renderPath) return;
    setLoading(true);
    const actionName = `${t("render3d.title")} (${renderNamespace}:${renderPath})`;
    addLog("info", `${actionName} ${t("loading")}`);
    try {
      const res = await render3dIconAction(renderNamespace, renderPath, renderFormat);
      if (res.error) {
        addLog("error", `${actionName} ${t("error")}: ${res.error}`);
        setPreviewImage(null);
      } else {
        addLog("success", `${actionName} ${t("success")}`);
        setPreviewImage({ format: res.format as "png" | "svg", data: res.data ?? "" });
      }
    } catch (err: any) {
      addLog("error", `${actionName} ${t("error")}: ${err.message}`);
      setPreviewImage(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    logs,
    previewImage,
    purgeNamespace,
    setPurgeNamespace,
    cleanNamespace,
    setCleanNamespace,
    cleanFolder,
    setCleanFolder,
    lsPrefix,
    setLsPrefix,
    lsLimit,
    setLsLimit,
    renderNamespace,
    setRenderNamespace,
    renderPath,
    setRenderPath,
    renderFormat,
    setRenderFormat,
    runReindex,
    runSweep,
    runSeed,
    runPurge,
    runClean,
    runLs,
    runRender3d,
  };
}

export type RecipeAdminState = ReturnType<typeof useRecipeAdmin>;
