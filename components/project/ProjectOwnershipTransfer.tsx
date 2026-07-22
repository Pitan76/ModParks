"use client";

import { useState, useTransition } from "react";
import type { ChangeEvent } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { transferOwnership } from "@/lib/actions/project";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type ProjectOwnershipTransferProps = {
  projectId: string;
};

/**
 * プロジェクトの所有権を別ユーザーへ移譲するための危険な操作を行うクライアントコンポーネント。
 */
const ProjectOwnershipTransfer = ({ projectId }: ProjectOwnershipTransferProps) => {
  const t = useTranslations("Project.ownership");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleTransfer = () => {
    if (!newOwnerId.trim() || isPending) return;

    if (!confirm(t("confirm"))) {
      return;
    }

    startTransition(async () => {
      try {
        await transferOwnership(projectId, newOwnerId.trim());
        alert(t("success"));
        router.push(`/projects`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to transfer ownership";
        alert(message);
      }
    });
  };

  return (
    <Card sx={{ border: "1px solid", borderColor: "error.main" }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 2 }} color="error">
          {t("transferTitle")}
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t("transferAlert")}
        </Alert>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TextField
            size="small"
            label={t("newOwnerId")}
            value={newOwnerId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setNewOwnerId(e.target.value)}
            disabled={isPending}
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            color="error"
            onClick={handleTransfer}
            disabled={!newOwnerId.trim() || isPending}
            sx={{ height: 40 }}
          >
            {t("transferButton")}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ProjectOwnershipTransfer;
