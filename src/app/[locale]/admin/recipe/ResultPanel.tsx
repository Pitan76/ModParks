"use client";

import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import type { LogEntry } from "./useRecipeAdmin";

function PreviewBox({ image }: { image: { format: "png" | "svg"; data: string } }) {
  const t = useTranslations("Admin.recipe");
  return (
    <Box sx={{ mb: 3, p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1 }}>
        {t("render3d.preview")}
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center", p: 2, bgcolor: "rgba(0,0,0,0.02)" }}>
        {image.format === "svg" ? (
          <Box
            dangerouslySetInnerHTML={{ __html: image.data }}
            sx={{ width: 128, height: 128, "& svg": { width: "100%", height: "100%" } }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.data} alt="Preview" style={{ width: 128, height: 128, objectFit: "contain" }} />
        )}
      </Box>
    </Box>
  );
}

function LogItem({ log }: { log: LogEntry }) {
  const severity = log.type === "success" ? "success" : log.type === "error" ? "error" : "info";
  return (
    <Alert severity={severity} sx={{ alignItems: "flex-start" }}>
      <Box sx={{ width: "100%" }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          [{log.time}]
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
          {log.message}
        </Typography>
        {log.details && (
          <Box
            component="pre"
            sx={{
              mt: 1,
              p: 1,
              backgroundColor: "rgba(0, 0, 0, 0.05)",
              borderRadius: 1,
              fontSize: "0.75rem",
              overflowX: "auto",
              maxWidth: "100%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(log.details, null, 2)}
          </Box>
        )}
      </Box>
    </Alert>
  );
}

type Props = {
  logs: LogEntry[];
  loading: boolean;
  previewImage: { format: "png" | "svg"; data: string } | null;
};

export default function ResultPanel({ logs, loading, previewImage }: Props) {
  const t = useTranslations("Admin.recipe");
  const showSpinner = loading && logs.length > 0 && logs[0].type === "info";

  return (
    <Paper
      variant="outlined"
      sx={{ p: 3, minHeight: 400, maxHeight: 600, overflowY: "auto", display: "flex", flexDirection: "column" }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {t("result")}
      </Typography>
      {previewImage && <PreviewBox image={previewImage} />}
      {showSpinner && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            {t("loading")}
          </Typography>
        </Box>
      )}
      <Stack spacing={2} sx={{ flexGrow: 1 }}>
        {logs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("resultPlaceholder")}
          </Typography>
        ) : (
          logs.map((log, index) => <LogItem key={index} log={log} />)
        )}
      </Stack>
    </Paper>
  );
}
