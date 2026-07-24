"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import {
  reindexRecipesAction,
  purgeRecipeCacheAction,
  sweepIngestsAction,
  cleanNamespaceFolderAction,
  seedAssetVersionsAction,
  listR2ObjectsAction,
  render3dIconAction,
} from "@/lib/actions/adminRecipe";

type LogEntry = {
  time: string;
  type: "success" | "error" | "info";
  message: string;
  details?: any;
};

export default function RecipeAdminClient() {
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

  const addLog = (type: "success" | "error" | "info", message: string, details?: any) => {
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        type,
        message,
        details,
      },
      ...prev,
    ]);
  };

  const handleAction = async (
    actionName: string,
    actionPromise: Promise<{ success?: boolean; data?: any; error?: string }>
  ) => {
    setLoading(true);
    addLog("info", `${actionName} ${t("loading")}`);
    try {
      const res = await actionPromise;
      if (res.error) {
        addLog("error", `${actionName} ${t("error")}: ${res.error}`);
      } else {
        addLog("success", `${actionName} ${t("success")}`, res.data);
      }
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
    handleAction(
      `${t("purge.title")} (${purgeNamespace})`,
      purgeRecipeCacheAction(purgeNamespace)
    );
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

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
        {t("title")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t("desc")}
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("reindex.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("reindex.desc")}
                </Typography>
                <Button variant="contained" onClick={runReindex} disabled={loading}>
                  {t("reindex.btn")}
                </Button>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("purge.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("purge.desc")}
                </Typography>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <TextField
                    size="small"
                    label={t("purge.placeholder")}
                    value={purgeNamespace}
                    onChange={(e) => setPurgeNamespace(e.target.value)}
                    disabled={loading}
                    sx={{ flexGrow: 1 }}
                  />
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={runPurge}
                    disabled={loading || !purgeNamespace}
                  >
                    {t("purge.btn")}
                  </Button>
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("sweep.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("sweep.desc")}
                </Typography>
                <Button variant="contained" color="inherit" onClick={runSweep} disabled={loading}>
                  {t("sweep.btn")}
                </Button>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("clean.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("clean.desc")}
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                      size="small"
                      label={t("clean.placeholder")}
                      value={cleanNamespace}
                      onChange={(e) => setCleanNamespace(e.target.value)}
                      disabled={loading}
                      sx={{ flexGrow: 1 }}
                    />
                    <TextField
                      size="small"
                      label={t("clean.folderPlaceholder")}
                      value={cleanFolder}
                      onChange={(e) => setCleanFolder(e.target.value)}
                      disabled={loading}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={runClean}
                    disabled={loading || !cleanNamespace || !cleanFolder}
                  >
                    {t("clean.btn")}
                  </Button>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("ls.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("ls.desc")}
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                      size="small"
                      label={t("ls.placeholder")}
                      value={lsPrefix}
                      onChange={(e) => setLsPrefix(e.target.value)}
                      disabled={loading}
                      sx={{ flexGrow: 2 }}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label={t("ls.limitPlaceholder")}
                      value={lsLimit}
                      onChange={(e) => setLsLimit(Number(e.target.value))}
                      disabled={loading}
                      sx={{ flexGrow: 1 }}
                    />
                  </Box>
                  <Button variant="contained" onClick={runLs} disabled={loading}>
                    {t("ls.btn")}
                  </Button>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("render3d.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("render3d.desc")}
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <TextField
                      size="small"
                      label={t("render3d.namespacePlaceholder")}
                      value={renderNamespace}
                      onChange={(e) => setRenderNamespace(e.target.value)}
                      disabled={loading}
                      sx={{ flexGrow: 1 }}
                    />
                    <TextField
                      size="small"
                      label={t("render3d.pathPlaceholder")}
                      value={renderPath}
                      onChange={(e) => setRenderPath(e.target.value)}
                      disabled={loading}
                      sx={{ flexGrow: 2 }}
                    />
                  </Box>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <TextField
                      select
                      size="small"
                      value={renderFormat}
                      onChange={(e) => setRenderFormat(e.target.value as "png" | "svg")}
                      disabled={loading}
                      slotProps={{
                        select: {
                          native: true
                        }
                      }}
                      sx={{ minWidth: 100 }}
                    >
                      <option value="png">PNG</option>
                      <option value="svg">SVG</option>
                    </TextField>
                    <Button
                      variant="contained"
                      onClick={runRender3d}
                      disabled={loading || !renderNamespace || !renderPath}
                    >
                      {t("render3d.btn")}
                    </Button>
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {t("seed.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t("seed.desc")}
                </Typography>
                <Button variant="contained" color="secondary" onClick={runSeed} disabled={loading}>
                  {t("seed.btn")}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              minHeight: 400,
              maxHeight: 600,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              {t("result")}
            </Typography>
            {previewImage && (
              <Box sx={{ mb: 3, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
                  {t("render3d.preview")}
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "center", p: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
                  {previewImage.format === "svg" ? (
                    <Box
                      dangerouslySetInnerHTML={{ __html: previewImage.data }}
                      sx={{ width: 128, height: 128, "& svg": { width: "100%", height: "100%" } }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewImage.data} alt="Preview" style={{ width: 128, height: 128, objectFit: "contain" }} />
                  )}
                </Box>
              </Box>
            )}
            {loading && logs.length > 0 && logs[0].type === "info" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t("loading")}
                </Typography>
              </Box>
            )}
            <Stack spacing={2} sx={{ flexGrow: 1 }}>
              {logs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t("resultPlaceholder")}
                </Typography>
              ) : (
                logs.map((log, index) => (
                  <Alert
                    key={index}
                    severity={
                      log.type === "success"
                        ? "success"
                        : log.type === "error"
                        ? "error"
                        : "info"
                    }
                    sx={{ alignItems: "flex-start" }}
                  >
                    <Box sx={{ width: "100%" }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        [{log.time}]
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
                        {log.message}
                      </Typography>
                      {log.details && (
                        <Box
                          component="pre"
                          sx={{
                            mt: 1,
                            p: 1,
                            backgroundColor: "rgba(0, 0, 0, 0.05)",
                            borderRadius: 1,
                            fontSize: "0.75rem",
                            overflowX: "auto",
                            maxWidth: "100%",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(log.details, null, 2)}
                        </Box>
                      )}
                    </Box>
                  </Alert>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
