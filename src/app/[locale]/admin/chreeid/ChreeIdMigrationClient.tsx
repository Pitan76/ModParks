"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { resyncChreeIdAction, runChreeIdMigrationAction } from "@/lib/actions/adminChreeId";
import type { ChreeIdResyncResult, ChreeIdRunResult } from "@/lib/chreeid/bulkMigration";

interface Props {
  enabled: boolean;
  total: number;
  pending: number;
  batchSize: number;
}

const sectionSx = { border: "1px solid", borderColor: "divider", borderRadius: 2, p: 3, mb: 3 };

/**
 * ChreeID への一括発行と洗い直しの操作欄。
 * どちらも1回で処理する人数を区切っているので、残りが無くなるまで押してもらう。
 */
export default function ChreeIdMigrationClient({ enabled, total, pending, batchSize }: Props) {
  const t = useTranslations("Admin.chreeid");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [runResult, setRunResult] = useState<ChreeIdRunResult | null>(null);
  const [resyncResult, setResyncResult] = useState<ChreeIdResyncResult | null>(null);

  if (!enabled) return <Alert severity="warning">{t("notConfigured")}</Alert>;

  const handleRun = async () => {
    setBusy(true);
    const res = await runChreeIdMigrationAction().finally(() => setBusy(false));
    if (res.success) setRunResult(res.result);
    router.refresh();
  };

  const handleResync = async () => {
    setBusy(true);
    const res = await resyncChreeIdAction(resyncResult?.next ?? 0).finally(() => setBusy(false));
    if (res.success) setResyncResult(res.result);
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>{t("policy")}</Alert>

      <Box sx={sectionSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("counts", { total, pending })}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("runDesc", { batchSize })}</Typography>
        {runResult && (
          <Alert severity={runResult.failed > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
            {t("runResult", { done: runResult.done, failed: runResult.failed, remaining: runResult.remaining })}
            {runResult.failures.map((failure) => <div key={failure}>{failure}</div>)}
          </Alert>
        )}
        {pending > 0
          ? <Button variant="contained" onClick={handleRun} disabled={busy}>{t("run")}</Button>
          : <Typography variant="body2">{t("allDone")}</Typography>}
      </Box>

      <Box sx={sectionSx}>
        <Typography variant="h6" sx={{ mb: 1 }}>{t("resyncTitle")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t("resyncDesc")}</Typography>
        {resyncResult && (
          <Alert severity={resyncResult.failed > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
            {t("resyncResult", { checked: resyncResult.checked, failed: resyncResult.failed, remaining: resyncResult.next === null ? 0 : resyncResult.total - resyncResult.next })}
            {resyncResult.failures.map((failure) => <div key={failure}>{failure}</div>)}
          </Alert>
        )}
        <Button variant="outlined" onClick={handleResync} disabled={busy}>
          {resyncResult?.next != null ? t("resyncContinue") : t("resync")}
        </Button>
      </Box>
    </Box>
  );
}
