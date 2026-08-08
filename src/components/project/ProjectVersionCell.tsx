"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import DownloadIcon from "@mui/icons-material/Download";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { importGithubRelease } from "@/lib/actions/github";

type ProjectVersionCellProps = {
  projectId?: string;
  projectSlug: string;
  githubRepo: string | null;
  latestVersionNumber: string | null;
};

export const ProjectVersionCell = ({
  projectSlug,
  githubRepo,
  latestVersionNumber,
}: ProjectVersionCellProps) => {
  const t = useTranslations("Project.batch");
  const router = useRouter();
  
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importGithubRelease(projectSlug);
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (latestVersionNumber) {
    return (
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {latestVersionNumber}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Box
        sx={{
          px: 1.5,
          py: 0.25,
          borderRadius: 1,
          bgcolor: "rgba(211, 47, 47, 0.08)",
          color: "error.main",
          border: "1px solid",
          borderColor: "rgba(211, 47, 47, 0.2)",
          display: "inline-flex",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.75rem" }}>
          {t("noVersionsRegistered")}
        </Typography>
      </Box>

      {githubRepo && (
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={importing ? <CircularProgress size={12} color="inherit" /> : <DownloadIcon sx={{ fontSize: "14px !important" }} />}
          onClick={handleImport}
          disabled={importing}
          sx={{ py: 0, minHeight: 0, fontSize: "0.75rem", textTransform: "none", mt: 0.5 }}
        >
          {importing ? t("importing") : t("importFromGithub")}
        </Button>
      )}

      {error && (
        <Typography variant="caption" color="error" title={error} sx={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default ProjectVersionCell;
