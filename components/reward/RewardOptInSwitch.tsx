"use client";

import { useState, useTransition } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { setCreatorRewardOptIn } from "@/lib/actions/creatorReward";

/** 還元への参加/辞退を切り替えるスイッチ */
export default function RewardOptInSwitch({ initialOptIn }: { initialOptIn: boolean }) {
  const t = useTranslations("CreatorReward");
  const [optIn, setOptIn] = useState(initialOptIn);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setError(null);
    setOptIn(next);
    startTransition(async () => {
      const result = await setCreatorRewardOptIn(next);
      if ("error" in result) {
        setOptIn(!next);
        setError(t("optInFailed"));
      }
    });
  }

  return (
    <Box>
      <FormControlLabel
        control={
          <Switch
            checked={optIn}
            disabled={isPending}
            onChange={(e) => handleChange(e.target.checked)}
          />
        }
        label={t("optInLabel")}
      />
      <Typography variant="body2" color="text.secondary">
        {t("optInHelp")}
      </Typography>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
}
