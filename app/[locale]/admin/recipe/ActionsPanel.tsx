"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import type { RecipeAdminState } from "./useRecipeAdmin";

/** アクションセクションの見出しと説明を描画する。 */
function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {desc}
      </Typography>
    </>
  );
}

export default function ActionsPanel({ state }: { state: RecipeAdminState }) {
  const t = useTranslations("Admin.recipe");
  const { loading } = state;

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
      <Stack spacing={3}>
        <Box>
          <SectionHeader title={t("reindex.title")} desc={t("reindex.desc")} />
          <Button variant="contained" onClick={state.runReindex} disabled={loading}>
            {t("reindex.btn")}
          </Button>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("purge.title")} desc={t("purge.desc")} />
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <TextField
              size="small"
              label={t("purge.placeholder")}
              value={state.purgeNamespace}
              onChange={(e) => state.setPurgeNamespace(e.target.value)}
              disabled={loading}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              color="warning"
              onClick={state.runPurge}
              disabled={loading || !state.purgeNamespace}
            >
              {t("purge.btn")}
            </Button>
          </Box>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("sweep.title")} desc={t("sweep.desc")} />
          <Button variant="contained" color="inherit" onClick={state.runSweep} disabled={loading}>
            {t("sweep.btn")}
          </Button>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("clean.title")} desc={t("clean.desc")} />
          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                size="small"
                label={t("clean.placeholder")}
                value={state.cleanNamespace}
                onChange={(e) => state.setCleanNamespace(e.target.value)}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              />
              <TextField
                size="small"
                label={t("clean.folderPlaceholder")}
                value={state.cleanFolder}
                onChange={(e) => state.setCleanFolder(e.target.value)}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              />
            </Box>
            <Button
              variant="contained"
              color="error"
              onClick={state.runClean}
              disabled={loading || !state.cleanNamespace || !state.cleanFolder}
            >
              {t("clean.btn")}
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("ls.title")} desc={t("ls.desc")} />
          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                size="small"
                label={t("ls.placeholder")}
                value={state.lsPrefix}
                onChange={(e) => state.setLsPrefix(e.target.value)}
                disabled={loading}
                sx={{ flexGrow: 2 }}
              />
              <TextField
                size="small"
                type="number"
                label={t("ls.limitPlaceholder")}
                value={state.lsLimit}
                onChange={(e) => state.setLsLimit(Number(e.target.value))}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              />
            </Box>
            <Button variant="contained" onClick={state.runLs} disabled={loading}>
              {t("ls.btn")}
            </Button>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("render3d.title")} desc={t("render3d.desc")} />
          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                size="small"
                label={t("render3d.namespacePlaceholder")}
                value={state.renderNamespace}
                onChange={(e) => state.setRenderNamespace(e.target.value)}
                disabled={loading}
                sx={{ flexGrow: 1 }}
              />
              <TextField
                size="small"
                label={t("render3d.pathPlaceholder")}
                value={state.renderPath}
                onChange={(e) => state.setRenderPath(e.target.value)}
                disabled={loading}
                sx={{ flexGrow: 2 }}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <TextField
                select
                size="small"
                value={state.renderFormat}
                onChange={(e) => state.setRenderFormat(e.target.value as "png" | "svg")}
                disabled={loading}
                slotProps={{ select: { native: true } }}
                sx={{ minWidth: 100 }}
              >
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </TextField>
              <Button
                variant="contained"
                onClick={state.runRender3d}
                disabled={loading || !state.renderNamespace || !state.renderPath}
              >
                {t("render3d.btn")}
              </Button>
            </Box>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <SectionHeader title={t("seed.title")} desc={t("seed.desc")} />
          <Button variant="contained" color="secondary" onClick={state.runSeed} disabled={loading}>
            {t("seed.btn")}
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
