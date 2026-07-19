"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import SearchIcon from "@mui/icons-material/Search";

export interface RecipeItem {
  id: string;
  url: string;
  title: string;
}

interface ProjectRecipesGridProps {
  recipes: RecipeItem[];
  labels: {
    search: string;
    noMatch: string;
    showMore: string;
  };
}

// 一度に描画（＝リクエスト）する枚数。段階表示でDOM上の <img> 数を制限し、
// 画像リクエストが一気に飛ばないようにする。lazy load と併用。
const PAGE_SIZE = 24;

export default function ProjectRecipesGrid({ recipes, labels }: ProjectRecipesGridProps) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
  }, [recipes, query]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > shown.length;

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
        <TextField
          size="small"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder={labels.search}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: "1 1 240px", maxWidth: 360 }}
        />
        <Typography variant="body2" color="text.secondary">
          {shown.length} / {filtered.length}
        </Typography>
      </Box>

      {filtered.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">{labels.noMatch}</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: {
              xs: "repeat(1, 1fr)",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
          }}
        >
          {shown.map((recipe) => (
            <Box key={recipe.id}>
              <img
                src={recipe.url}
                alt={recipe.title}
                loading="lazy"
                style={{ objectFit: "contain", width: "100%", height: "auto" }}
              />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.5,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={recipe.title}
              >
                {recipe.title}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {hasMore && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Button variant="outlined" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            {labels.showMore}
          </Button>
        </Box>
      )}
    </Box>
  );
}
