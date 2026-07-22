"use client";

import { useState, useTransition } from "react";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { useTranslations } from "next-intl";
import { toggleProjectSubscription } from "@/lib/actions/notification";

type ProjectSubscribeButtonProps = {
  projectId: string;
  initialSubscribed: boolean;
};

/** プロジェクトの新リリース通知を購読するベルトグル */
const ProjectSubscribeButton = ({ projectId, initialSubscribed }: ProjectSubscribeButtonProps) => {
  const t = useTranslations("Notifications");
  const [isPending, startTransition] = useTransition();
  const [subscribed, setSubscribed] = useState(initialSubscribed);

  const handleClick = () => {
    if (isPending) return;
    setSubscribed((prev) => !prev);
    startTransition(async () => {
      const result = await toggleProjectSubscription(projectId);
      if ("subscribed" in result) setSubscribed(result.subscribed);
    });
  };

  return (
    <Tooltip title={subscribed ? t("subscribe.subscribed") : t("subscribe.subscribe")}>
      <IconButton onClick={handleClick} disabled={isPending} color={subscribed ? "primary" : "default"}>
        {subscribed ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
      </IconButton>
    </Tooltip>
  );
};

export default ProjectSubscribeButton;
