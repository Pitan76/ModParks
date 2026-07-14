"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    if (!confirm("本当にこのリストを削除しますか？この操作は元に戻せません。")) return;
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
      title="リストを編集"
      titleProps={{ sx: { fontWeight: "bold" } }}
      actions={
        <>
          <Button color="error" onClick={handleDelete} disabled={loading}>削除</Button>
          <Box>
            <Button onClick={onClose} disabled={loading} sx={{ mr: 1 }}>キャンセル</Button>
            <Button variant="contained" onClick={handleSave} disabled={loading || !name} disableElevation>保存</Button>
          </Box>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
        <FormTextField
          label="リスト名"
          fullWidth
          required
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <FormTextField
          label="説明"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <FormSelect
          label="公開範囲"
          value={visibility}
          onChange={e => setVisibility(e.target.value as string)}
          options={[
            { value: "public", label: "公開" },
            { value: "unlisted", label: "限定公開" },
            { value: "private", label: "非公開" },
          ]}
          formControlProps={{ fullWidth: true }}
        />

          {/* アイコン設定 */}
          <Box sx={{ border: "1px solid", borderColor: "divider", p: 2, borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>アイコン設定</Typography>
            <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
              <Button 
                variant={iconSource === "url" ? "contained" : "outlined"} 
                onClick={() => setIconSource("url")}
                size="small"
                disableElevation
              >
                URL入力 / 画像アップロード
              </Button>
              <Button 
                variant={iconSource === "projects" ? "contained" : "outlined"} 
                onClick={() => setIconSource("projects")}
                size="small"
                disableElevation
              >
                プロジェクトから選択
              </Button>
            </Box>

            {iconSource === "url" && (
              <FormTextField
                label="アイコンのURL (またはアップロード)"
                fullWidth
                size="small"
                value={iconUrl}
                onChange={e => setIconUrl(e.target.value)}
                placeholder="https://..."
                helperText="※アップロード機能は将来実装予定です。現在はURLを入力してください。"
              />
            )}

            {iconSource === "projects" && (
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
                {collection.items.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    リストにプロジェクトがありません。
                  </Typography>
                )}
              </Box>
            )}
            
            {iconUrl && (
              <Box sx={{ mt: 3, display: "flex", alignItems: "center", gap: 2 }}>
                <Typography variant="body2" color="text.secondary">プレビュー:</Typography>
                <Avatar src={iconUrl} variant="rounded" sx={{ width: 64, height: 64, boxShadow: 1 }} />
                <Button size="small" color="error" onClick={() => setIconUrl("")}>クリア</Button>
              </Box>
            )}
          </Box>
      </Box>
    </AbstractDialog>
  );
}
