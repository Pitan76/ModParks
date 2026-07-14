"use client";

import { useState, useEffect, useTransition } from "react";
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

interface AddToCollectionModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
}

export default function AddToCollectionModal({ open, onClose, projectId, userId }: AddToCollectionModalProps) {
  const tProject = useTranslations("Project"); // fallback translations
  const tList = useTranslations("List");
  const tCommon = useTranslations("Common");
  
  const [collections, setCollections] = useState<any[]>([]);
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
        setCollections(data);
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
          setCollections(data);
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
            {tList("close")}
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
                    secondary={c.visibility === "public" ? tProject("form.public") : c.visibility === "unlisted" ? tProject("form.unlisted") : tProject("form.private")} 
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCollectionName(e.target.value)}
              sx={{ mb: 2 }}
              disabled={isPending}
            />
            <FormSelect
              label={tProject("form.status")}
              value={newCollectionVisibility}
              onChange={(e) => setNewCollectionVisibility(e.target.value as any)}
              disabled={isPending}
              options={[
                { value: "public", label: tProject("form.public") },
                { value: "unlisted", label: tProject("form.unlisted") },
                { value: "private", label: tProject("form.private") },
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
