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

interface ProjectOwnershipTransferProps {
  projectId: string;
}

export default function ProjectOwnershipTransfer({ projectId }: ProjectOwnershipTransferProps) {
  const [newOwnerId, setNewOwnerId] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleTransfer = () => {
    if (!newOwnerId.trim() || isPending) return;

    if (!confirm("本当にプロジェクトのオーナー権限を譲渡しますか？\nこの操作は取り消せません。譲渡後、あなたはこのプロジェクトのオーナーではなくなります。")) {
      return;
    }

    startTransition(async () => {
      try {
        await transferOwnership(projectId, newOwnerId.trim());
        alert("オーナー権限を譲渡しました。");
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
          Danger Zone: オーナー権限の譲渡
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          プロジェクトのオーナー権限を他のユーザーに譲渡します。一度譲渡すると、元に戻すことはできません。
          譲渡先のユーザーID（username ではありません）を正確に入力してください。
        </Alert>

        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TextField
            size="small"
            label="新しいオーナーのユーザーID"
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
            権限を譲渡
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
