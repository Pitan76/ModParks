"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Link from "@mui/material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ActionRow from "@/components/ui/ActionRow";
import LoaderAutocomplete from "./LoaderAutocomplete";
import { getLoaderInfo } from "@/lib/loaders";
import { addProjectDependencyBySlug, addExternalProjectDependency, removeProjectDependency } from "@/lib/actions/dependency";
import type { DependencyType, DependencyProjectSummary } from "@/lib/actions/dependency";
import { isActionError, type ActionResult } from "@/lib/actions/actionResult";
import { isStaleServerActionError } from "@/lib/errors/staleAction";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";

type PlatformOption = { slug: string; name: string };

export type ProjectDependenciesManagerProps = {
  projectId: string;
  dependencies: {
    id: string;
    dependencyType: DependencyType;
    project: DependencyProjectSummary;
    externalUrl?: string | null;
    externalName?: string | null;
    /** 依存が要るプラットフォーム。空なら全プラットフォーム */
    loaders?: string[];
  }[];
  availablePlatforms?: PlatformOption[];
};

/**
 * プロジェクトの依存関係を管理（追加・削除）する管理者向けクライアントコンポーネント。
 * ModParks内部プロジェクトへの参照、または外部URLによる依存定義を切り替えて登録できます。
 */
const ProjectDependenciesManager = ({ projectId, dependencies, availablePlatforms = [] }: ProjectDependenciesManagerProps) => {
  const [tab, setTab] = useState(0);
  const [targetSlug, setTargetSlug] = useState("");
  const [extName, setExtName] = useState("");
  const [extUrl, setExtUrl] = useState("");
  const [depType, setDepType] = useState<DependencyType>("required");
  const [depLoaders, setDepLoaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const router = useRouter();
  const t = useTranslations("Project.dependencies");
  const tError = useTranslations("ServerErrors");

  /**
   * Server Action の結果を捌く。
   *
   * 想定内の拒否は理由がそのまま返るので出すだけ。デプロイを跨いだ古いタブからの
   * 送信だけは再読み込みで直るため、その旨を出して自動で読み直す。
   */
  const runAction = async (action: () => Promise<ActionResult>, successMessage: string): Promise<boolean> => {
    try {
      const result = await action();
      if (isActionError(result)) {
        setToast({ message: result.error, severity: "error" });
        return false;
      }
      setToast({ message: successMessage, severity: "success" });
      return true;
    } catch (err: unknown) {
      if (isStaleServerActionError(err)) {
        setToast({ message: tError("common.staleAction"), severity: "error" });
        setTimeout(() => window.location.reload(), 1500);
        return false;
      }
      setToast({ message: tError("common.serverError"), severity: "error" });
      return false;
    }
  };

  const handleAdd = async () => {
    setLoading(true);

    const ok = await runAction(
      () => tab === 0
        ? addProjectDependencyBySlug(projectId, targetSlug, depType, { loaders: depLoaders })
        : addExternalProjectDependency(projectId, extName, extUrl, depType, { loaders: depLoaders }),
      t("addSuccess"),
    );

    if (ok) {
      setTargetSlug("");
      setExtName("");
      setExtUrl("");
      setDepLoaders([]);
      router.refresh();
    }
    setLoading(false);
  };

  const handleRemove = async (depId: string) => {
    setLoading(true);
    if (await runAction(() => removeProjectDependency(depId), t("removeSuccess"))) {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>{t("add")}</Typography>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2, width: "100%", overflow: "hidden" }}>
        <Tabs 
          value={tab} 
          onChange={(_, v) => setTab(v)} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ 
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '100%' },
            '& .MuiTab-root': {
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }
          }}
        >
          <Tab label="ModParks Project" />
          <Tab label="External URL" />
        </Tabs>
      </Box>
      
      <ActionRow align="flex-end" wrap sx={{ mb: 4 }}>
        {tab === 0 ? (
          <TextField
            label={t("targetSlug")}
            value={targetSlug}
            onChange={(e) => setTargetSlug(e.target.value)}
            size="small"
            sx={{ flex: "1 1 200px" }}
          />
        ) : (
          <>
            <TextField
              label="Name (e.g. Fabric API)"
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              size="small"
              sx={{ flex: "1 1 120px" }}
            />
            <TextField
              label="URL (e.g. https://modrinth.com/...)"
              value={extUrl}
              onChange={(e) => setExtUrl(e.target.value)}
              size="small"
              sx={{ flex: "2 1 200px" }}
            />
          </>
        )}
        <FormControl size="small" sx={{ flex: "1 1 120px" }}>
          <InputLabel>{t("type")}</InputLabel>
          <Select
            value={depType}
            label={t("type")}
            onChange={(e) => setDepType(e.target.value as DependencyType)}
          >
            <MenuItem value="required">{t("required")}</MenuItem>
            <MenuItem value="optional">{t("optional")}</MenuItem>
            <MenuItem value="incompatible">{t("incompatible")}</MenuItem>
            <MenuItem value="embedded">{t("embedded")}</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" onClick={handleAdd} disabled={loading || (tab === 0 ? !targetSlug : (!extName || !extUrl))}>
          {t("add")}
        </Button>
      </ActionRow>

      {/* 前提MODはローダーごとに違う（Fabric なら Fabric API など）ので、
          プラットフォームを絞れるようにする。未選択なら全プラットフォーム */}
      <Box sx={{ mb: 4, mt: -2 }}>
        <LoaderAutocomplete
          availablePlatforms={availablePlatforms}
          loaders={depLoaders}
          onChange={setDepLoaders}
          label={t("platformScope")}
          size="small"
          required={false}
          helperText={t("platformScopeHint")}
        />
      </Box>

      <Typography variant="h6" gutterBottom>{t("current")}</Typography>
      <List>
        {dependencies.map((dep) => (
          <ListItem key={dep.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 1 }}>
            <ListItemText 
              primary={dep.externalName ? (
                <Link href={dep.externalUrl!} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  {dep.externalName} <OpenInNewIcon fontSize="small" />
                </Link>
              ) : dep.project.title} 
              secondary={`${t("type")}: ${t(dep.dependencyType)} | ${dep.externalUrl ? "External" : `Slug: ${dep.project.slug}`}`}
            />
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexWrap: "wrap", mr: 5 }}>
              {(dep.loaders ?? []).map((loader) => (
                <Chip key={loader} size="small" label={getLoaderInfo(loader).name} sx={{ height: 22 }} />
              ))}
            </Stack>
            <ListItemSecondaryAction>
              <IconButton edge="end" onClick={() => handleRemove(dep.id)} disabled={loading}>
                <DeleteIcon />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
        {dependencies.length === 0 && (
          <Typography color="text.secondary">{t("noDependencies")}</Typography>
        )}
      </List>
      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity || "info"} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ProjectDependenciesManager;
