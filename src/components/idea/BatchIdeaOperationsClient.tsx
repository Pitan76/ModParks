"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";
import BatchIdeaMetadataDialog from "./BatchIdeaMetadataDialog";
import BatchIdeaOperationsTable from "./BatchIdeaOperationsTable";
import { useBatchIdeaOperations } from "./useBatchIdeaOperations";

type IdeaForManagement = {
  id: string;
  title: string;
  visibility: string;
  status: string;
  createdAt: Date;
  slug: string;
};

interface OptionItem {
  slug: string;
  name: string;
}

export type BatchIdeaOperationsClientProps = {
  ideas: IdeaForManagement[];
  availableTags: OptionItem[];
  availablePlatforms: OptionItem[];
};

export default function BatchIdeaOperationsClient({
  ideas,
  availableTags = [],
  availablePlatforms = [],
}: BatchIdeaOperationsClientProps) {
  const t = useTranslations("Idea.batch");
  const tIdea = useTranslations("Idea");
  const tCommon = useTranslations("Common");
  const m = useBatchIdeaOperations(ideas);

  const [visibilityAnchorEl, setVisibilityAnchorEl] = useState<null | HTMLElement>(null);
  const [resolutionAnchorEl, setResolutionAnchorEl] = useState<null | HTMLElement>(null);

  const handleVisibilitySelect = (status: "public" | "unlisted" | "private" | "draft") => {
    setVisibilityAnchorEl(null);
    m.handleBatchStatus(status);
  };

  const handleResolutionSelect = (status: "open" | "in_progress" | "fulfilled") => {
    setResolutionAnchorEl(null);
    m.handleBatchResolution(status);
  };

  const actionDisabled = m.selected.size === 0 || m.loading;

  return (
    <Box>
      {m.error && <Alert severity="error" sx={{ mb: 3 }}>{m.error}</Alert>}

      <Box sx={{ mb: 2, display: "flex", gap: { xs: 1, sm: 2 }, alignItems: "center", flexWrap: "wrap" }}>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={(e) => setVisibilityAnchorEl(e.currentTarget)}
          disabled={actionDisabled}
        >
          {t("changeStatus")}
        </Button>
        <Menu anchorEl={visibilityAnchorEl} open={Boolean(visibilityAnchorEl)} onClose={() => setVisibilityAnchorEl(null)}>
          <MenuItem onClick={() => handleVisibilitySelect("public")}>{tCommon("visibility.public")}</MenuItem>
          <MenuItem onClick={() => handleVisibilitySelect("unlisted")}>{tCommon("visibility.unlisted")}</MenuItem>
          <MenuItem onClick={() => handleVisibilitySelect("private")}>{tCommon("visibility.private")}</MenuItem>
          <MenuItem onClick={() => handleVisibilitySelect("draft")}>{tCommon("visibility.draft")}</MenuItem>
        </Menu>

        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={(e) => setResolutionAnchorEl(e.currentTarget)}
          disabled={actionDisabled}
        >
          {t("changeResolution")}
        </Button>
        <Menu anchorEl={resolutionAnchorEl} open={Boolean(resolutionAnchorEl)} onClose={() => setResolutionAnchorEl(null)}>
          <MenuItem onClick={() => handleResolutionSelect("open")}>{tIdea("status.open")}</MenuItem>
          <MenuItem onClick={() => handleResolutionSelect("in_progress")}>{tIdea("status.in_progress")}</MenuItem>
          <MenuItem onClick={() => handleResolutionSelect("fulfilled")}>{tIdea("status.resolved")}</MenuItem>
        </Menu>

        <Button
          variant="contained"
          color="secondary"
          startIcon={<EditIcon />}
          onClick={() => m.setMetadataDialogOpen(true)}
          disabled={actionDisabled}
        >
          {t("editMetadata")}
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => m.setDeleteDialogOpen(true)}
          disabled={actionDisabled}
        >
          {t("delete")}
        </Button>

        <Box sx={{ flexGrow: 1 }} />
        {m.selected.size > 0 && (
          <Box sx={{ typography: "body2", color: "text.secondary" }}>
            {t("selectedCount", { count: m.selected.size })}
          </Box>
        )}
      </Box>

      <BatchIdeaOperationsTable
        ideas={ideas}
        selected={m.selected}
        onToggle={m.handleToggle}
        onToggleAll={m.handleToggleAll}
        getResolutionLabel={m.getResolutionLabel}
      />

      <TypedConfirmDialog
        open={m.deleteDialogOpen}
        onClose={() => !m.loading && m.setDeleteDialogOpen(false)}
        onConfirm={m.handleBatchDelete}
        title={t("deleteTitle")}
        description={t.rich("deleteDescription", { count: m.selected.size, b: (chunks) => <strong>{chunks}</strong> })}
        expectedValue="DELETE"
        expectedValueLabel={t("deleteConfirmLabel")}
        pending={m.loading}
      />

      <BatchIdeaMetadataDialog
        open={m.metadataDialogOpen}
        onClose={() => m.setMetadataDialogOpen(false)}
        selectedCount={m.selected.size}
        availableTags={availableTags}
        availablePlatforms={availablePlatforms}
        pending={m.loading}
        onSubmit={m.handleBatchMetadataSubmit}
      />
    </Box>
  );
}
