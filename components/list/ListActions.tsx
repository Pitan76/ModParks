"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import EditIcon from "@mui/icons-material/Edit";
import dynamic from "next/dynamic";

// ダイアログは開くまで不要なので client 専用で遅延ロードし、サーバーバンドルから外す。
const EditListDialog = dynamic(() => import("./EditListDialog"), { ssr: false });

export default function ListActions({ isOwner, collection, ownerUsername }: { isOwner: boolean; collection: any; ownerUsername?: string }) {
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
          ownerUsername={ownerUsername}
        />
      )}
    </>
  );
}
