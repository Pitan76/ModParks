"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddToCollectionModal from "./AddToCollectionModal";

interface AddToCollectionButtonProps {
  projectId: string;
  userId: string;
  variant?: "button" | "icon";
}

export default function AddToCollectionButton({ projectId, userId, variant = "button" }: AddToCollectionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title="リストに保存">
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
          リストに保存
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
}
