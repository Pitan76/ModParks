"use client";

import { useState, useEffect, useTransition } from "react";
import type { ChangeEvent } from "react";
import AbstractDialog from "@/components/ui/AbstractDialog";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { getUserCollections, createCollection, addProjectsToCollection } from "@/lib/actions/collection";
import type { CartItem } from "./cartStore";

export type SaveCartToCollectionModalProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  items: CartItem[];
  /** 保存が終わったときに件数を伝える（呼び出し側でスナックバー表示） */
  onSaved: (added: number) => void;
};

type CollectionRow = {
  id: string;
  name: string;
  visibility: string;
};

/**
 * カートの中身をまとめてコレクション（リスト）へ保存するモーダル。
 * 既にリストに入っているプロジェクトは重複追加されない。
 */
export default function SaveCartToCollectionModal({ open, onClose, userId, items, onSaved }: SaveCartToCollectionModalProps) {
  const tProject = useTranslations("Project");
  const tList = useTranslations("List");
  const tCommon = useTranslations("Common");

  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionVisibility, setNewCollectionVisibility] = useState<"public" | "unlisted" | "private">("public");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCreating(false);
    setNewCollectionName("");
    getUserCollections(userId, userId)
      .then((data) => {
        setCollections(data as CollectionRow[]);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [open, userId]);

  function handleSave(collectionId: string) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const result = await addProjectsToCollection(collectionId, items.map((i) => i.id));
        onSaved(result.added);
        onClose();
      } catch (err) {
        console.error(err);
        alert(tCommon("error"));
      }
    });
  }

  function handleCreate() {
    if (!newCollectionName.trim() || isPending) return;

    startTransition(async () => {
      try {
        const result = await createCollection(newCollectionName.trim(), null, newCollectionVisibility);
        if (!result.success) return;
        const saved = await addProjectsToCollection(result.id, items.map((i) => i.id));
        onSaved(saved.added);
        onClose();
      } catch (err) {
        console.error(err);
        alert(tCommon("error"));
      }
    });
  }

  function visibilityLabel(visibility: string) {
    if (visibility === "public") return tCommon("visibility.public");
    if (visibility === "unlisted") return tCommon("visibility.unlisted");
    return tCommon("visibility.private");
  }

  return (
    <AbstractDialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      title={tList("saveToList")}
      titleProps={{ sx: { fontWeight: "bold" } }}
      actions={
        <>
          <Button onClick={onClose} variant="text" color="inherit">
            {tCommon("close")}
          </Button>
          {!creating && (
            <Button variant="text" onClick={() => setCreating(true)} disabled={isPending}>
              {tList("createNewList")}
            </Button>
          )}
        </>
      }
    >
      <Box sx={{ p: 0, m: -3 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ pt: 0, pb: 0 }}>
            {collections.length === 0 && !creating && (
              <ListItem>
                <ListItemText primary={tList("noLists")} secondary={tList("pleaseCreateList")} />
              </ListItem>
            )}
            {collections.map((c) => (
              <ListItem key={c.id} disablePadding>
                <ListItemButton onClick={() => handleSave(c.id)} dense disabled={isPending}>
                  <ListItemText primary={c.name} secondary={visibilityLabel(c.visibility)} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {creating && (
          <Box sx={{ p: 2, bgcolor: "background.default" }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>{tList("createListHeading")}</Typography>
            <FormTextField
              label={tProject("fields.name")}
              size="small"
              fullWidth
              value={newCollectionName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCollectionName(e.target.value)}
              sx={{ mb: 2 }}
              disabled={isPending}
            />
            <FormSelect
              label={tProject("form.status")}
              value={newCollectionVisibility}
              onChange={(e) => setNewCollectionVisibility(e.target.value as "public" | "unlisted" | "private")}
              disabled={isPending}
              options={[
                { value: "public", label: tCommon("visibility.public") },
                { value: "unlisted", label: tCommon("visibility.unlisted") },
                { value: "private", label: tCommon("visibility.private") },
              ]}
              formControlProps={{ fullWidth: true, size: "small", sx: { mb: 2 } }}
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setCreating(false)} disabled={isPending}>
                {tCommon("cancel")}
              </Button>
              <Button size="small" variant="contained" onClick={handleCreate} disabled={!newCollectionName.trim() || isPending}>
                {tCommon("create")}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </AbstractDialog>
  );
}
