"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

/** 編集画面に並べる1レシピ。名前と画像URLはレシピCDNの索引から来る。 */
export type ManagedRecipe = {
  id: string;
  name: string;
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
};

export type RecipeCardProps = {
  recipe: ManagedRecipe;
  isHidden: boolean;
  busy: boolean;
  onToggle: () => void;
  labelVisible: string;
  labelHidden: string;
};

const RecipeCard = ({ recipe, isHidden, busy, onToggle, labelVisible, labelHidden }: RecipeCardProps) => {
  // R2から直接取る URL は未生成の画像だと404になる。そのときだけCDNのWorkerに生成させる。
  const [failed, setFailed] = useState(false);

  return (
    <Box
      sx={{
        p: 1,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
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
      <Typography variant="body2" noWrap title={recipe.name} sx={{ mt: 0.5 }}>
        {recipe.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap title={recipe.id} sx={{ display: "block" }}>
        {recipe.id}
      </Typography>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          {isHidden ? labelHidden : labelVisible}
        </Typography>
        <Switch
          size="small"
          checked={!isHidden}
          onChange={onToggle}
          disabled={busy}
          slotProps={{ input: { "aria-label": recipe.name } }}
        />
      </Stack>
    </Box>
  );
};

export default RecipeCard;
