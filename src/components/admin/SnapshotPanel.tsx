"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { generateSnapshotNow } from "@/lib/actions/runtime";

type Result = { projectCount: number; authorCount: number; deletedCount: number; shellFiles: number };

/**
 * 静的スナップショットの手動生成。
 *
 * 通常は日次 Cron に相乗りしているが、それだと確認に丸一日かかる。
 * モードを切り替える前に中身を確かめられるようにする。
 */
export default function SnapshotPanel() {
  const t = useTranslations("Admin.runtime");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setMessage(null);
    startTransition(async () => {
      const result = await generateSnapshotNow();
      if ("error" in result) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      const detail = result.detail as Result;
      setMessage({
        type: "success",
        text: t("snapshotDone", {
          projects: detail.projectCount,
          authors: detail.authorCount,
          deleted: detail.deletedCount,
        }),
      });
    });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">{t("snapshotHelp")}</Typography>

      {message && (
        <Alert severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>
      )}

      <Button
        variant="outlined"
        onClick={handleGenerate}
        disabled={isPending}
        sx={{ alignSelf: "flex-start" }}
      >
        {isPending ? t("snapshotRunning") : t("snapshotGenerate")}
      </Button>
    </Stack>
  );
}
