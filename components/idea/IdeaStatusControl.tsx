"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import { updateIdeaStatus } from "@/lib/actions/idea";

interface IdeaStatusControlProps {
  ideaId: string;
  initialStatus: "open" | "in_progress" | "fulfilled";
}

export default function IdeaStatusControl({ ideaId, initialStatus }: IdeaStatusControlProps) {
  const router = useRouter();
  const tIdea = useTranslations("Idea");
  const [pending, setPending] = useState(false);

  const handleChange = async (event: any) => {
    const newStatus = event.target.value as "open" | "in_progress" | "fulfilled";
    if (newStatus === initialStatus) return;

    setPending(true);
    const result = await updateIdeaStatus(ideaId, newStatus);
    if (!result?.error) {
      router.refresh();
    }
    setPending(false);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <FormControl size="small" variant="outlined" sx={{ minWidth: 120 }}>
        <Select
          value={initialStatus}
          onChange={handleChange}
          disabled={pending}
          sx={{ height: 32, fontSize: "0.875rem", fontWeight: 600 }}
        >
          <MenuItem value="open">{tIdea("status.open")}</MenuItem>
          <MenuItem value="in_progress">{tIdea("status.in_progress")}</MenuItem>
          <MenuItem value="fulfilled">{tIdea("status.resolved")}</MenuItem>
        </Select>
      </FormControl>
      {pending && <CircularProgress size={16} />}
    </Box>
  );
}
