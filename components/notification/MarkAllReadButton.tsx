"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { markAllNotificationsRead } from "@/lib/actions/notification";

export default function MarkAllReadButton() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const handleClick = async () => {
    setPending(true);
    await markAllNotificationsRead();
    router.refresh();
    setPending(false);
  };

  return (
    <Button onClick={handleClick} disabled={pending} startIcon={<DoneAllIcon />} size="small">
      {t("markAllRead")}
    </Button>
  );
}
