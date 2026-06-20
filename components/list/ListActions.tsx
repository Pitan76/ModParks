"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import EditListDialog from "./EditListDialog";

export default function ListActions({ isOwner, collection }: { isOwner: boolean; collection: any }) {
  const [open, setOpen] = useState(false);

  if (!isOwner) return null;

  return (
    <>
      <Button 
        variant="outlined" 
        startIcon={<EditIcon />}
        onClick={() => setOpen(true)}
        size="small"
      >
        リストを編集
      </Button>
      {open && (
        <EditListDialog 
          open={open} 
          onClose={() => setOpen(false)} 
          collection={collection} 
        />
      )}
    </>
  );
}
