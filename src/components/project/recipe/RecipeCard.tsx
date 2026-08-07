"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

/** 編集画面に並べる1レシピ。名前と画像URLはレシピCDNの索引から来る。 */
export type ManagedRecipe = {
  id: string;
  name: string;
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
  originalName?: string;
};

export type RecipeCardProps = {
  recipe: ManagedRecipe;
  isHidden: boolean;
  busy: boolean;
  onToggle: () => void;
  onRename: (newName: string) => Promise<{ error?: string } | void>;
  labelVisible: string;
  labelHidden: string;
};

const RecipeCard = ({ recipe, isHidden, busy, onToggle, onRename, labelVisible, labelHidden }: RecipeCardProps) => {
  // R2から直接取る URL は未生成の画像だと404になる。そのときだけCDNのWorkerに生成させる。
  const [failed, setFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(recipe.name);
  const [renaming, setRenaming] = useState(false);

  // 外部から recipe.name が更新されたら同期する
  useEffect(() => {
    setEditName(recipe.name);
  }, [recipe.name]);

  const handleRenameSave = async () => {
    setRenaming(true);
    const res = await onRename(editName);
    setRenaming(false);
    if (!res?.error) {
      setIsEditing(false);
    }
  };

  const handleRenameCancel = () => {
    setEditName(recipe.name);
    setIsEditing(false);
  };

  return (
    <Box
      sx={{
        p: 1,
        opacity: isHidden ? 0.45 : 1,
      }}
    >
      {/* レシピ画像はCDNが生成した固定サイズのPNG。next/image を通す利点がないため img で出す */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={failed ? recipe.fallbackUrl : recipe.url}
        alt={recipe.name}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "auto", imageRendering: "pixelated" }}
      />
      
      {isEditing ? (
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: "center" }}>
          <TextField
            size="small"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            disabled={renaming || busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSave();
              if (e.key === "Escape") handleRenameCancel();
            }}
            autoFocus
            slotProps={{
              htmlInput: {
                style: { fontSize: "0.75rem", padding: "4px 6px" },
                "aria-label": "Edit recipe name"
              }
            }}
            sx={{ flexGrow: 1 }}
          />
          <IconButton size="small" onClick={handleRenameSave} disabled={renaming || busy} color="primary" sx={{ p: 0.5 }}>
            <CheckIcon fontSize="inherit" style={{ fontSize: "1rem" }} />
          </IconButton>
          <IconButton size="small" onClick={handleRenameCancel} disabled={renaming || busy} sx={{ p: 0.5 }}>
            <CloseIcon fontSize="inherit" style={{ fontSize: "1rem" }} />
          </IconButton>
        </Stack>
      ) : (
        <Stack direction="row" sx={{ mt: 0.5, alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" noWrap title={recipe.name} sx={{ flexGrow: 1, mr: 1, fontSize: "0.875rem" }}>
            {recipe.name}
          </Typography>
          <IconButton
            size="small"
            onClick={() => {
              setEditName(recipe.name);
              setIsEditing(true);
            }}
            disabled={busy}
            sx={{ p: 0.5 }}
            title="Edit name"
          >
            <EditIcon fontSize="inherit" style={{ fontSize: "1rem" }} />
          </IconButton>
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" noWrap title={recipe.id} sx={{ display: "block", fontSize: "0.75rem" }}>
        {recipe.id}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          {isHidden ? labelHidden : labelVisible}
        </Typography>
        <Switch
          size="small"
          checked={!isHidden}
          onChange={onToggle}
          disabled={busy || isEditing}
          slotProps={{ input: { "aria-label": recipe.name } }}
        />
      </Stack>
    </Box>
  );
};

export default RecipeCard;
