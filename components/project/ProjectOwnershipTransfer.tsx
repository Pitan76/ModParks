"use client";

import { useState, useTransition } from "react";
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

interface ProjectOwnershipTransferProps {
  projectId: string;
}

export default function ProjectOwnershipTransfer({ projectId }: ProjectOwnershipTransferProps) {
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
      } catch (err: any) {
        alert(err.message);
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
            onChange={e => setNewOwnerId(e.target.value)}
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
}
