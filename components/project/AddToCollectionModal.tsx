"use client";

import { useState, useEffect, useTransition } from "react";
import type { ChangeEvent } from "react";
import AbstractDialog from "@/components/ui/AbstractDialog";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { getUserCollectionsWithProjectStatus, toggleProjectInCollection, createCollection } from "@/lib/actions/collection";

export type AddToCollectionModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
};

type CollectionItem = {
  id: string;
  name: string;
  containsProject: boolean;
  visibility: string;
};

/**
 * プロジェクトをユーザーのコレクション（ブックマークリスト）に保存・整理するためのモーダルコンポーネント。
 */
const AddToCollectionModal = ({ open, onClose, projectId, userId }: AddToCollectionModalProps) => {
  const tProject = useTranslations("Project");
  const tList = useTranslations("List");
  const tCommon = useTranslations("Common");
  
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionVisibility, setNewCollectionVisibility] = useState<"public" | "unlisted" | "private">("public");

  useEffect(() => {
    if (open) {
      setLoading(true);
      setCreating(false);
      setNewCollectionName("");
      getUserCollectionsWithProjectStatus(userId, projectId).then(data => {
        setCollections(data as CollectionItem[]);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    }
  }, [open, userId, projectId]);

  const handleToggle = (collectionId: string, currentStatus: boolean) => {
    if (isPending) return;

    // Optimistic UI
    setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, containsProject: !currentStatus } : c));

    startTransition(async () => {
      try {
        await toggleProjectInCollection(collectionId, projectId);
      } catch (err) {
        console.error(err);
        // Revert
        setCollections(prev => prev.map(c => c.id === collectionId ? { ...c, containsProject: currentStatus } : c));
        alert(tCommon("error"));
      }
    });
  };

  const handleCreate = () => {
    if (!newCollectionName.trim() || isPending) return;

    startTransition(async () => {
      try {
        const result = await createCollection(newCollectionName.trim(), null, newCollectionVisibility);
        if (result.success) {
          // Immediately toggle the project in the new collection
          await toggleProjectInCollection(result.id, projectId);
          // Refresh list
          const data = await getUserCollectionsWithProjectStatus(userId, projectId);
          setCollections(data as CollectionItem[]);
          setCreating(false);
          setNewCollectionName("");
        }
      } catch (err) {
        console.error(err);
        alert(tCommon("error"));
      }
    });
  };

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
            <Button 
              variant="text"
              onClick={() => setCreating(true)}
              disabled={isPending}
            >
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
                <ListItemButton role={undefined} onClick={() => handleToggle(c.id, c.containsProject)} dense disabled={isPending}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={c.containsProject}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText 
                    primary={c.name} 
                    secondary={c.visibility === "public" ? tCommon("visibility.public") : c.visibility === "unlisted" ? tCommon("visibility.unlisted") : tCommon("visibility.private")} 
                  />
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
              onChange={(e) => setNewCollectionVisibility(e.target.value as any)}
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
};

export default AddToCollectionModal;
