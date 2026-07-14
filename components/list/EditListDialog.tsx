"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import AbstractDialog from "@/components/ui/AbstractDialog";
import Button from "@mui/material/Button";
import FormTextField from "@/components/ui/form/FormTextField";
import FormSelect from "@/components/ui/form/FormSelect";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";

interface ProjectItem {
  id: string;
  name: string;
  iconUrl: string | null;
}

interface CollectionData {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  iconUrl: string | null;
  items: ProjectItem[];
}

interface EditListDialogProps {
  open: boolean;
  onClose: () => void;
  collection: CollectionData;
  ownerUsername?: string;
}

export default function EditListDialog({ open, onClose, collection, ownerUsername }: EditListDialogProps) {
  const router = useRouter();
  const tList = useTranslations("List");
  const tProject = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [visibility, setVisibility] = useState(collection.visibility);
  const [iconUrl, setIconUrl] = useState(collection.iconUrl || "");
  const [loading, setLoading] = useState(false);
  const [iconSource, setIconSource] = useState<"url" | "projects">("url");

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, visibility, iconUrl }),
      });

      if (!res.ok) {
        throw new Error("Failed to update collection");
      }

      router.refresh();
      onClose();
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(tList("deleteConfirm"))) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/collections/${collection.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete collection");

      // 削除後は所有者のプロフィール（リスト一覧を含む）へ戻す
      router.push(ownerUsername ? `/profile/${ownerUsername}` : "/");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AbstractDialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      title={tList("editList")}
      titleProps={{ sx: { fontWeight: "bold" } }}
      actions={
        <>
          <Button color="error" onClick={handleDelete} disabled={loading}>{tCommon("delete")}</Button>
          <Box>
            <Button onClick={onClose} disabled={loading} sx={{ mr: 1 }}>{tCommon("cancel")}</Button>
            <Button variant="contained" onClick={handleSave} disabled={loading || !name} disableElevation>{tCommon("save")}</Button>
          </Box>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
        <FormTextField
          label={tProject("fields.name")}
          fullWidth
          required
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <FormTextField
          label={tProject("fields.description")}
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <FormSelect
          label={tProject("form.status")}
          value={visibility}
          onChange={e => setVisibility(e.target.value as string)}
          options={[
            { value: "public", label: tCommon("visibility.public") },
            { value: "unlisted", label: tCommon("visibility.unlisted") },
            { value: "private", label: tCommon("visibility.private") },
          ]}
          formControlProps={{ fullWidth: true }}
        />

          {/* アイコン設定 */}
          <Box sx={{ border: "1px solid", borderColor: "divider", p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>{tList("iconSettings")}</Typography>
            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <Button 
                variant={iconSource === "url" ? "contained" : "outlined"} 
                onClick={() => setIconSource("url")}
                size="small"
                disableElevation
              >
                {tList("iconUrlOrUpload")}
              </Button>
              <Button 
                variant={iconSource === "projects" ? "contained" : "outlined"} 
                onClick={() => setIconSource("projects")}
                size="small"
                disableElevation
              >
                {tList("iconFromProject")}
              </Button>
            </Box>

            {iconSource === "url" && (
              <FormTextField
                label={tList("iconUrlLabel")}
                fullWidth
                size="small"
                value={iconUrl}
                onChange={e => setIconUrl(e.target.value)}
                placeholder="https://..."
                helperText={tList("iconUrlHelper")}
              />
            )}

            {iconSource === "projects" && (
              collection.items.length > 0 ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  {collection.items.map(item => (
                    <Avatar
                      key={item.id}
                      src={item.iconUrl || ""}
                      alt={item.name}
                      sx={{ 
                        width: 48, height: 48, 
                        cursor: "pointer",
                        border: iconUrl === item.iconUrl ? "2px solid #1976d2" : "2px solid transparent",
                        transition: "0.2s",
                        "&:hover": { opacity: 0.8 }
                      }}
                      onClick={() => setIconUrl(item.iconUrl || "")}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {tList("noProjectsInList")}
                </Typography>
              )
            )}
            
            {iconUrl && (
              <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="body2" color="text.secondary">{tList("preview")}</Typography>
                <Avatar src={iconUrl} variant="rounded" sx={{ width: 48, height: 48 }} />
                <Button size="small" color="error" onClick={() => setIconUrl("")}>{tCommon("clear")}</Button>
              </Box>
            )}
          </Box>
      </Box>
    </AbstractDialog>
  );
}
