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
import { cropGeometry } from "@/lib/recipe/settings";

export type RecipeItem = {
  id: string;
  url: string;
  /** `url` が404だったときの取得先。CDNのWorkerが画像を生成して返す */
  fallbackUrl: string;
  title: string;
};

type ProjectRecipesGridProps = {
  recipes: RecipeItem[];
  /** 上下左右から削る余白の量（ネイティブpx）。切り抜きはCDNに作り直させず、ここのCSSで行う */
  crop?: number;
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
  crop?: number;
};

const RecipeGridItem = ({ recipe, crop }: RecipeGridItemProps) => {
  // R2から直接取る URL は未生成の画像だと404になる。そのときだけCDNのWorkerに生成させる。
  const [failed, setFailed] = useState(false);
  const src = failed ? recipe.fallbackUrl : recipe.url;
  const geometry = cropGeometry(crop);

  const image = (
    <ZoomableImage
      src={src}
      onError={() => setFailed(true)}
      alt={recipe.title}
      loading="lazy"
      pixelated
      style={{ objectFit: "contain", width: "100%", height: "auto" }}
    />
  );

  return (
    <Box>
      {/* 枠からはみ出させて隠すことで切り抜く。寸法はすべて百分率なので、
          列数や画面幅が変わっても同じ位置で切れる。 */}
      {geometry ? (
        <Box sx={{ position: "relative", overflow: "hidden", width: "100%", aspectRatio: geometry.aspectRatio }}>
          <Box sx={{ position: "absolute", left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height }}>
            {image}
          </Box>
        </Box>
      ) : (
        image
      )}
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
const ProjectRecipesGrid = ({ recipes, crop, openUrl, labels }: ProjectRecipesGridProps) => {
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
            <RecipeGridItem key={recipe.id} recipe={recipe} crop={crop} />
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
