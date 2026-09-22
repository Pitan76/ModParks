"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import { useTranslations } from "next-intl";
import AbstractDialog from "@/components/ui/AbstractDialog";
import LoaderAutocomplete from "@/components/project/LoaderAutocomplete";
import McVersionAutocomplete from "@/components/project/McVersionAutocomplete";
import TagAutocomplete from "@/components/project/TagAutocomplete";

export type IdeaDetailFilters = {
  loaders: string[];
  mcVersions: string[];
  tags: string[];
};

type IdeaFilterDialogProps = {
  onClose: () => void;
  onApply: (filters: IdeaDetailFilters) => void;
  initialFilters: IdeaDetailFilters;
  availableTags: { slug: string; name: string }[];
  availablePlatforms: { slug: string; name: string }[];
};

/**
 * アイデア一覧の詳細な絞り込み（ローダー・MCバージョン・タグ）。プロジェクト一覧の詳細検索と同じ形。
 * 「適用」を押すまで一覧を動かさないよう、編集中の値は手元に持つ。
 * 開くたびに初期値から始めるため、呼び出し側は開いている間だけ描画する。
 */
export default function IdeaFilterDialog({ onClose, onApply, initialFilters, availableTags, availablePlatforms }: IdeaFilterDialogProps) {
  const t = useTranslations("Search");
  const [loaders, setLoaders] = useState(initialFilters.loaders);
  const [mcVersions, setMcVersions] = useState(initialFilters.mcVersions);
  const [tags, setTags] = useState(initialFilters.tags);

  return (
    <AbstractDialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title={t("advancedSearch")}
      onConfirm={() => onApply({ loaders, mcVersions, tags })}
      onCancel={onClose}
      confirmText={t("apply")}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 2 }}>
        <LoaderAutocomplete
          availablePlatforms={availablePlatforms}
          loaders={loaders}
          onChange={setLoaders}
          label={t("platforms")}
          size="small"
          required={false}
        />
        <McVersionAutocomplete value={mcVersions} onChange={setMcVersions} label={t("mcVersions")} size="small" required={false} />
        <TagAutocomplete availableTags={availableTags} tags={tags} onChange={setTags} label={t("tags")} size="small" required={false} />
      </Box>
    </AbstractDialog>
  );
}
