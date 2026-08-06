"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { useRecipeAdmin } from "./useRecipeAdmin";
import ActionsPanel from "./ActionsPanel";
import ResultPanel from "./ResultPanel";

export default function RecipeAdminClient() {
  const t = useTranslations("Admin.recipe");
  const state = useRecipeAdmin();

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
          <ActionsPanel state={state} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ResultPanel logs={state.logs} loading={state.loading} previewImage={state.previewImage} />
        </Grid>
      </Grid>
    </Box>
  );
}
