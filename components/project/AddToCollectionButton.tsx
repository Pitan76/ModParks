"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useTranslations } from "next-intl";
import AddToCollectionModal from "./AddToCollectionModal";

type AddToCollectionButtonProps = {
  projectId: string;
  userId: string;
  variant?: "button" | "icon";
};

/** プロジェクトをコレクションに追加するボタン。アイコンモードとボタンモードを切り替え可能 */
const AddToCollectionButton = ({ projectId, userId, variant = "button" }: AddToCollectionButtonProps) => {
  const tList = useTranslations("List");
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title={tList("saveToList")}>
          <IconButton onClick={() => setOpen(true)} color="default">
            <PlaylistAddIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<PlaylistAddIcon />}
          onClick={() => setOpen(true)}
          fullWidth
          sx={{ borderRadius: 2, height: "40px" }}
        >
          {tList("saveToList")}
        </Button>
      )}
      {open && (
        <AddToCollectionModal
          open={open}
          onClose={() => setOpen(false)}
          projectId={projectId}
          userId={userId}
        />
      )}
    </>
  );
};

export default AddToCollectionButton;
