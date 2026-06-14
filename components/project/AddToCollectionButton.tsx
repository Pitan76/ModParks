"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import AddToCollectionModal from "./AddToCollectionModal";

export default function AddToCollectionButton({ projectId, userId }: { projectId: string; userId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<PlaylistAddIcon />}
        onClick={() => setOpen(true)}
        sx={{ borderRadius: 2, height: "40px" }}
      >
        リストに保存
      </Button>
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
