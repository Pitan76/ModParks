"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import Checkbox from "@mui/material/Checkbox";
import AbstractDialog from "@/components/ui/AbstractDialog";
import TagAutocomplete from "@/components/project/TagAutocomplete";
import LoaderAutocomplete from "@/components/project/LoaderAutocomplete";
import McVersionAutocomplete from "@/components/project/McVersionAutocomplete";
import { useTranslations } from "next-intl";

interface OptionItem {
  slug: string;
  name: string;
}

export type BatchIdeaMetadataDialogProps = {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  availableTags: OptionItem[];
  availablePlatforms: OptionItem[];
  pending: boolean;
  onSubmit: (
    operation: "add" | "remove" | "set",
    mcVersions: string[],
    loaders: string[],
    tags: string[],
    targets: { mcVersions: boolean; loaders: boolean; tags: boolean }
  ) => Promise<boolean>;
};

export default function BatchIdeaMetadataDialog({
  open,
  onClose,
  selectedCount,
  availableTags = [],
  availablePlatforms = [],
  pending,
  onSubmit,
}: BatchIdeaMetadataDialogProps) {
  const tCommon = useTranslations("Common");
  const t = useTranslations("Idea.batch");
  const tFields = useTranslations("Idea.fields");

  const [operation, setOperation] = useState<"add" | "remove" | "set">("add");
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  // 各項目を更新対象にするかどうかの状態
  const [applyMcVersions, setApplyMcVersions] = useState(false);
  const [applyLoaders, setApplyLoaders] = useState(false);
  const [applyTags, setApplyTags] = useState(false);

  const handleClose = () => {
    if (pending) return;
    setMcVersions([]);
    setLoaders([]);
    setTags([]);
    onClose();
  };

  const handleConfirm = async () => {
    const ok = await onSubmit(
      operation,
      mcVersions,
      loaders,
      tags,
      { mcVersions: applyMcVersions, loaders: applyLoaders, tags: applyTags }
    );
    if (ok) {
      handleClose();
    }
  };

  const isConfirmDisabled =
    (!applyMcVersions && !applyLoaders && !applyTags) ||
    (applyMcVersions && mcVersions.length === 0) ||
    (applyLoaders && loaders.length === 0) ||
    (applyTags && tags.length === 0);

  return (
    <AbstractDialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      title={t("editMetadataTitle")}
      onCancel={handleClose}
      onConfirm={handleConfirm}
      cancelText={tCommon("cancel")}
      confirmText={tCommon("save")}
      isSubmitting={pending}
      confirmDisabled={isConfirmDisabled}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3.5, pt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t("editMetadataDesc", { count: selectedCount })}
        </Typography>

        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1, color: "text.primary" }}>
            {t("opType")}
          </FormLabel>
          <RadioGroup value={operation} onChange={(e) => setOperation(e.target.value as "add" | "remove" | "set")}>
            <FormControlLabel value="add" control={<Radio size="small" />} label={t("opAdd")} />
            <FormControlLabel value="remove" control={<Radio size="small" />} label={t("opRemove")} />
            <FormControlLabel value="set" control={<Radio size="small" />} label={t("opSet")} />
          </RadioGroup>
        </FormControl>

        {/* 1. MCバージョン */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyMcVersions} onChange={(e) => setApplyMcVersions(e.target.checked)} size="small" />}
            label={t("applyMcVersions")}
          />
          {applyMcVersions && (
            <McVersionAutocomplete
              value={mcVersions}
              onChange={setMcVersions}
              label={tFields("mcVersions")}
              size="small"
            />
          )}
        </Box>

        {/* 2. プラットフォーム/ローダー */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyLoaders} onChange={(e) => setApplyLoaders(e.target.checked)} size="small" />}
            label={t("applyLoaders")}
          />
          {applyLoaders && (
            <LoaderAutocomplete
              availablePlatforms={availablePlatforms}
              loaders={loaders}
              onChange={setLoaders}
              label={tFields("loaders")}
              size="small"
            />
          )}
        </Box>

        {/* 3. タグ */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <FormControlLabel
            control={<Checkbox checked={applyTags} onChange={(e) => setApplyTags(e.target.checked)} size="small" />}
            label={t("applyTags")}
          />
          {applyTags && (
            <TagAutocomplete
              availableTags={availableTags}
              tags={tags}
              onChange={setTags}
              label={tFields("tags")}
              size="small"
            />
          )}
        </Box>
      </Box>
    </AbstractDialog>
  );
}
