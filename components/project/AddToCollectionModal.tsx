"use client";

import { useState, useEffect, useTransition } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useTranslations } from "next-intl";
import { getUserCollectionsWithProjectStatus, toggleProjectInCollection, createCollection } from "@/lib/actions/collection";

interface AddToCollectionModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string;
}

export default function AddToCollectionModal({ open, onClose, projectId, userId }: AddToCollectionModalProps) {
  const t = useTranslations("Project"); // fallback translations
  // Normally we would have translations for Collection, using fallback for now
  
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
        alert("Failed to update collection.");
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
        alert("Failed to create collection.");
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: "bold" }}>リストに保存</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ pt: 0, pb: 0 }}>
            {collections.length === 0 && !creating && (
              <ListItem>
                <ListItemText primary="リストがありません" secondary="新しくリストを作成してください" />
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
                    secondary={c.visibility === "public" ? "公開" : c.visibility === "unlisted" ? "限定公開" : "非公開"} 
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {creating && (
          <Box sx={{ p: 2, bgcolor: "background.default" }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>新しいリストを作成</Typography>
            <TextField
              label="名前"
              size="small"
              fullWidth
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              sx={{ mb: 2 }}
              disabled={isPending}
            />
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>公開設定</InputLabel>
              <Select
                value={newCollectionVisibility}
                label="公開設定"
                onChange={(e) => setNewCollectionVisibility(e.target.value as any)}
                disabled={isPending}
              >
                <MenuItem value="public">公開</MenuItem>
                <MenuItem value="unlisted">限定公開</MenuItem>
                <MenuItem value="private">非公開</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setCreating(false)} disabled={isPending}>
                キャンセル
              </Button>
              <Button size="small" variant="contained" onClick={handleCreate} disabled={!newCollectionName.trim() || isPending}>
                作成
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        <Button onClick={onClose} variant="text" color="inherit">
          閉じる
        </Button>
        {!creating && (
          <Button 
            variant="text"
            onClick={() => setCreating(true)}
            disabled={isPending}
          >
            新しくリストを作成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
