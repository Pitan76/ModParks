"use client";

import { useState, useTransition } from "react";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { setShowIdeasOnProfile } from "@/lib/actions/profilePins";

/** 本人のみ表示。プロフィールへの投稿アイデア表示 ON/OFF を切り替える。 */
export default function IdeasVisibilityToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("Profile");
  const [show, setShow] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setShow(val);
    startTransition(async () => {
      await setShowIdeasOnProfile(val);
      router.refresh();
    });
  };

  return (
    <FormControlLabel
      control={<Switch checked={show} onChange={handleChange} disabled={pending} size="small" />}
      label={t("showIdeas")}
      sx={{ mr: 0 }}
    />
  );
}
