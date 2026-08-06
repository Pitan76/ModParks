"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Pagination from "@mui/material/Pagination";
import SearchIcon from "@mui/icons-material/Search";
import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useColorMode } from "@/components/ThemeRegistry";
import ZoomableImage from "@/components/ui/ZoomableImage";

export type RecipeItem = {
  id: string;
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
  title: string;
};

type ProjectRecipesGridProps = {
  recipes: RecipeItem[];
  /** レシピCDNの検索ページ（このプロジェクトのネームスペースで絞った状態）へのリンク */
  openUrl: string;
  labels: {
    search: string;
    noMatch: string;
    showMore: string;
    openInRecipeSite: string;
  };
};

type RecipeGridItemProps = {
  recipe: RecipeItem;
};

const RecipeGridItem = ({ recipe }: RecipeGridItemProps) => {
  // R2から直接取る URL は未生成の画像だと404になる。そのときだけCDNのWorkerに生成させる。
  const [failed, setFailed] = useState(false);
  const src = failed ? recipe.fallbackUrl : recipe.url;

  return (
    <Box>
      <ZoomableImage
        src={src}
        onError={() => setFailed(true)}
        alt={recipe.title}
        loading="lazy"
        pixelated
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
  );
};

// 一度に描画（＝リクエスト）する枚数。段階表示でDOM上の <img> 数を制限し、
// 画像リクエストが一気に飛ばないようにする。lazy load と併用。
const PAGE_SIZE = 24;

/**
 * プロジェクトに含まれるレシピ画像をグリッド表示するクライアントコンポーネント。
 * クエリでのフィルタリング、ページング表示に対応しています。
 */
const ProjectRecipesGrid = ({ recipes, openUrl, labels }: ProjectRecipesGridProps) => {
  const { isNewTheme } = useColorMode();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) => r.title.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
  }, [recipes, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const shown = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
        <TextField
          size="small"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
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
          {shown.length + (page - 1) * PAGE_SIZE} / {filtered.length}
        </Typography>
        <Button
          component="a"
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          endIcon={<OpenInNewIcon />}
          sx={{ ml: "auto" }}
        >
          {labels.openInRecipeSite}
        </Button>
      </Box>

      {filtered.length === 0 ? (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">{labels.noMatch}</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: isNewTheme ? 3 : 2,
            gridTemplateColumns: isNewTheme
              ? "repeat(auto-fill, minmax(180px, 1fr))"
              : {
                  xs: "repeat(1, 1fr)",
                  sm: "repeat(2, 1fr)",
                  md: "repeat(3, 1fr)",
                },
          }}
        >
          {shown.map((recipe) => (
            <RecipeGridItem key={recipe.id} recipe={recipe} />
          ))}
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default ProjectRecipesGrid;
