"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { proposeWorkerVarsChange, type WorkerVar } from "@/lib/actions/workerVars";

export default function WorkerVarsPanel({
  initialVars,
  loadError,
}: {
  initialVars: WorkerVar[];
  loadError?: string;
}) {
  const t = useTranslations("Admin.config");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initialVars.map((v) => [v.key, v.value]))
  );
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const changes = Object.fromEntries(
    initialVars
      .filter((v) => v.editable && values[v.key] !== v.value)
      .map((v) => [v.key, values[v.key]])
  );
  const hasChanges = Object.keys(changes).length > 0;

  const handlePropose = () => {
    setError(null);
    setPrUrl(null);
    startTransition(async () => {
      const result = await proposeWorkerVarsChange(changes);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPrUrl(result.prUrl);
    });
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("workerVars")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t("workerVarsDesc")}
        </Typography>

        {loadError && <Alert severity="warning" sx={{ mb: 2 }}>{loadError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {prUrl && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t("prCreated")}{" "}
            <Link href={prUrl} target="_blank" rel="noopener noreferrer">{prUrl}</Link>
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {initialVars.map((v) => (
            <TextField
              key={v.key}
              label={v.key}
              value={values[v.key] ?? ""}
              disabled={!v.editable}
              helperText={v.editable ? undefined : t("varProtected")}
              onChange={(e) => setValues({ ...values, [v.key]: e.target.value })}
              fullWidth
            />
          ))}
        </Box>

        <Button
          variant="contained"
          onClick={handlePropose}
          disabled={isPending || !hasChanges}
          sx={{ mt: 3 }}
        >
          {t("createPr")}
        </Button>
      </CardContent>
    </Card>
  );
}
