"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
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
}

export default function EditListDialog({ open, onClose, collection }: EditListDialogProps) {
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

      router.push("/"); // TODO: Redirect to profile or lists index
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: "bold" }}>リストを編集</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 1 }}>
          <TextField
            label="リスト名"
            fullWidth
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="説明"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FormControl fullWidth>
            <InputLabel>公開範囲</InputLabel>
            <Select
              value={visibility}
              label="公開範囲"
              onChange={(e) => setVisibility(e.target.value)}
            >
              <MenuItem value="public">公開</MenuItem>
              <MenuItem value="unlisted">限定公開</MenuItem>
              <MenuItem value="private">非公開</MenuItem>
            </Select>
          </FormControl>

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
              <TextField
                label="アイコンのURL (またはアップロード)"
                fullWidth
                size="small"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
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
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between", px: 3, pb: 2 }}>
        <Button color="error" onClick={handleDelete} disabled={loading}>削除</Button>
        <Box>
          <Button onClick={onClose} disabled={loading} sx={{ mr: 1 }}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading || !name} disableElevation>保存</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
