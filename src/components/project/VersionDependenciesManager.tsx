"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
// クライアントからは Server Action 経由で呼ぶ。クエリ本体を直接 import すると
// サーバー専用モジュールがクライアントバンドルに混入してビルドが壊れる
import {
  addExternalProjectDependency,
  addProjectDependencyBySlug,
  getVersionDependencies,
  removeProjectDependency,
  type DependencyEntry,
} from "@/lib/actions/dependency";
import { isActionError, type ActionResult } from "@/lib/actions/actionResult";
import { isStaleServerActionError } from "@/lib/errors/staleAction";
import { DEPENDENCY_TYPES, type DependencyType } from "@/lib/dependencies/types";
import { DEPENDENCY_COLOR } from "./VersionDependencies";

type Props = {
  projectId: string;
  versionId: string;
};

/**
 * バージョン単位の依存関係を編集するUI。バージョン編集ダイアログの中で使う。
 *
 * プロジェクト全体の依存も参考として並べるが、ここから消せるのはこのバージョンに
 * 紐づくものだけ。全体の依存はプロジェクト編集画面の持ち物なので触らせない。
 */
export default function VersionDependenciesManager({ projectId, versionId }: Props) {
  const t = useTranslations("Project.dependencies");
  const tError = useTranslations("ServerErrors");
  const [entries, setEntries] = useState<DependencyEntry[] | null>(null);
  const [mode, setMode] = useState<"internal" | "external">("internal");
  const [targetSlug, setTargetSlug] = useState("");
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [depType, setDepType] = useState<DependencyType>("required");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setEntries(await getVersionDependencies(projectId, versionId));
    } catch {
      setEntries([]);
    }
  }, [projectId, versionId]);

  // 対象バージョンごとに key を変えて使う前提なので、初期化は初回の読み込みだけで足りる
  useEffect(() => {
    // Server Action の応答待ちのため setState は同期実行されない（false positive 回避）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const canSubmit = mode === "internal" ? !!targetSlug.trim() : !!extName.trim() && !!extUrl.trim();

  /**
   * Server Action の結果を捌く。想定内の拒否は理由をそのまま出し、
   * デプロイを跨いだ古いタブからの送信だけは再読み込みを促す。
   */
  const runAction = async (action: () => Promise<ActionResult>): Promise<boolean> => {
    try {
      const result = await action();
      if (isActionError(result)) {
        setError(result.error);
        return false;
      }
      return true;
    } catch (err: unknown) {
      setError(isStaleServerActionError(err) ? tError("common.staleAction") : tError("common.serverError"));
      return false;
    }
  };

  const handleAdd = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);

    const ok = await runAction(() => mode === "internal"
      ? addProjectDependencyBySlug(projectId, targetSlug.trim(), depType, { versionId })
      : addExternalProjectDependency(projectId, extName.trim(), extUrl.trim(), depType, { versionId }));

    if (ok) {
      setTargetSlug("");
      setExtName("");
      setExtUrl("");
      await reload();
    }
    setPending(false);
  };

  const handleRemove = async (dependencyId: string) => {
    setPending(true);
    setError(null);
    if (await runAction(() => removeProjectDependency(dependencyId))) {
      await reload();
    }
    setPending(false);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        {t("forVersion")}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        {t("versionScopeHint")}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          color="primary"
          value={mode}
          onChange={(_, val) => val && setMode(val)}
        >
          <ToggleButton value="internal">ModParks</ToggleButton>
          <ToggleButton value="external">External URL</ToggleButton>
        </ToggleButtonGroup>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          {mode === "internal" ? (
            <TextField
              label={t("targetSlug")}
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              size="small"
              sx={{ flex: "1 1 auto" }}
            />
          ) : (
            <>
              <TextField
                label="Name"
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
                size="small"
                sx={{ flex: "1 1 auto" }}
              />
              <TextField
                label="URL"
                value={extUrl}
                onChange={(e) => setExtUrl(e.target.value)}
                size="small"
                sx={{ flex: "2 1 auto" }}
              />
            </>
          )}
          <TextField
            select
            label={t("type")}
            value={depType}
            onChange={(e) => setDepType(e.target.value as DependencyType)}
            size="small"
            sx={{ minWidth: 140 }}
          >
            {DEPENDENCY_TYPES.map((type) => (
              <MenuItem key={type} value={type}>{t(type)}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={handleAdd} disabled={pending || !canSubmit} sx={{ whiteSpace: "nowrap" }}>
            {t("add")}
          </Button>
        </Stack>
      </Stack>

      {entries === null ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">{t("noDependencies")}</Typography>
      ) : (
        <List dense disablePadding sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          {entries.map((dep, i) => (
            <ListItem
              key={dep.id}
              divider={i !== entries.length - 1}
              secondaryAction={dep.versionId ? (
                <IconButton edge="end" size="small" color="error" onClick={() => handleRemove(dep.id)} disabled={pending}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ) : undefined}
              sx={dep.versionId ? undefined : { opacity: 0.7 }}
            >
              <ListItemText
                primary={dep.externalName || dep.project.title}
                secondary={dep.externalUrl || dep.project.slug}
                slotProps={{ secondary: { sx: { wordBreak: "break-all" } } }}
              />
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mr: dep.versionId ? 4 : 0 }}>
                {!dep.versionId && <Chip size="small" variant="outlined" label={t("projectWide")} sx={{ height: 22 }} />}
                <Chip size="small" label={t(dep.dependencyType)} color={DEPENDENCY_COLOR[dep.dependencyType]} sx={{ height: 22 }} />
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
