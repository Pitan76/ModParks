"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import AddIcon from "@mui/icons-material/Add";
import { useTranslations } from "next-intl";
import { createTag, updateTag, deleteTag, createPlatform, updatePlatform, deletePlatform } from "@/lib/actions/config";

import type { Tag, Platform } from "@/db/schema";

export default function ConfigClient({ initialTags, initialPlatforms }: { initialTags: Tag[], initialPlatforms: Platform[] }) {
  const tAdmin = useTranslations("Admin.config");

  // Tag Dialog State
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagForm, setTagForm] = useState({ name: "", slug: "", description: "" });

  // Platform Dialog State
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [platformForm, setPlatformForm] = useState({ name: "", slug: "", iconUrl: "" });

  // --- Tags Handlers ---
  const handleOpenTagDialog = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setTagForm({ name: tag.name, slug: tag.slug, description: tag.description || "" });
    } else {
      setEditingTag(null);
      setTagForm({ name: "", slug: "", description: "" });
    }
    setTagDialogOpen(true);
  };

  const handleSaveTag = async () => {
    try {
      if (editingTag) {
        await updateTag(editingTag.id, tagForm.name, tagForm.slug, tagForm.description);
      } else {
        await createTag(tagForm.name, tagForm.slug, tagForm.description);
      }
      setTagDialogOpen(false);
    } catch (error) {
      console.error(error);
      alert("Failed to save tag.");
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm("Are you sure you want to delete this tag?")) return;
    try {
      await deleteTag(id);
    } catch (error) {
      console.error(error);
      alert("Failed to delete tag.");
    }
  };

  // --- Platforms Handlers ---
  const handleOpenPlatformDialog = (platform?: Platform) => {
    if (platform) {
      setEditingPlatform(platform);
      setPlatformForm({ name: platform.name, slug: platform.slug, iconUrl: platform.iconUrl || "" });
    } else {
      setEditingPlatform(null);
      setPlatformForm({ name: "", slug: "", iconUrl: "" });
    }
    setPlatformDialogOpen(true);
  };

  const handleSavePlatform = async () => {
    try {
      if (editingPlatform) {
        await updatePlatform(editingPlatform.id, platformForm.name, platformForm.slug, platformForm.iconUrl);
      } else {
        await createPlatform(platformForm.name, platformForm.slug, platformForm.iconUrl);
      }
      setPlatformDialogOpen(false);
    } catch (error) {
      console.error(error);
      alert("Failed to save platform.");
    }
  };

  const handleDeletePlatform = async (id: string) => {
    if (!confirm("Are you sure you want to delete this platform?")) return;
    try {
      await deletePlatform(id);
    } catch (error) {
      console.error(error);
      alert("Failed to delete platform.");
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      
      {/* --- General Settings Section --- */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{tAdmin("general")}</Typography>
          <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 600 }}>
            <TextField label={tAdmin("siteName")} defaultValue="ModParks" size="small" />
            <TextField label={tAdmin("siteDesc")} defaultValue="Minecraft Mod & Plugin Platform" size="small" multiline rows={3} />
            <Button variant="contained" sx={{ alignSelf: "flex-start" }} onClick={() => alert("General settings mock saved!")}>
              {tAdmin("saveBtn")}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* --- Tags Section --- */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">{tAdmin("tagsManagement")}</Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenTagDialog()}>
              Add Tag
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage the categories/tags that projects can use.
          </Typography>
          
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {initialTags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                onDelete={() => handleDeleteTag(tag.id)}
                onClick={() => handleOpenTagDialog(tag)}
                variant="outlined"
                color="primary"
              />
            ))}
            {initialTags.length === 0 && (
              <Typography variant="body2" color="text.secondary">No tags configured.</Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* --- Platforms Section --- */}
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Platforms Management</Typography>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => handleOpenPlatformDialog()}>
              Add Platform
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage the target environments (e.g. Forge, Fabric, Spigot).
          </Typography>
          
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {initialPlatforms.map((platform) => (
              <Chip
                key={platform.id}
                label={platform.name}
                onDelete={() => handleDeletePlatform(platform.id)}
                onClick={() => handleOpenPlatformDialog(platform)}
                variant="outlined"
                color="secondary"
              />
            ))}
            {initialPlatforms.length === 0 && (
              <Typography variant="body2" color="text.secondary">No platforms configured.</Typography>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTag ? "Edit Tag" : "New Tag"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            value={tagForm.name}
            onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
            fullWidth
            sx={{ mt: 1 }}
          />
          <TextField
            label="Slug (e.g. magic, tech)"
            value={tagForm.slug}
            onChange={(e) => setTagForm({ ...tagForm, slug: e.target.value })}
            fullWidth
          />
          <TextField
            label="Description (Optional)"
            value={tagForm.description}
            onChange={(e) => setTagForm({ ...tagForm, description: e.target.value })}
            fullWidth
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTag} variant="contained" disabled={!tagForm.name || !tagForm.slug}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Platform Dialog */}
      <Dialog open={platformDialogOpen} onClose={() => setPlatformDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingPlatform ? "Edit Platform" : "New Platform"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            label="Name"
            value={platformForm.name}
            onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })}
            fullWidth
            sx={{ mt: 1 }}
          />
          <TextField
            label="Slug (e.g. forge, fabric)"
            value={platformForm.slug}
            onChange={(e) => setPlatformForm({ ...platformForm, slug: e.target.value })}
            fullWidth
          />
          <TextField
            label="Icon URL (Optional)"
            value={platformForm.iconUrl}
            onChange={(e) => setPlatformForm({ ...platformForm, iconUrl: e.target.value })}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlatformDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSavePlatform} variant="contained" disabled={!platformForm.name || !platformForm.slug}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
