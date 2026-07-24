"use client";

import { useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { reviewScanAppeal } from "@/lib/actions/scanAppeal";
import type { ScanFinding } from "@/workers/jar/src/types";

type AppealRow = {
  appeal: { id: string; reason: string; createdAt: Date | number };
  version: { id: string; versionNumber: string; scanStatus: string; scanFindings: string | null };
  project: { slug: string; name: string };
  appellant: { username: string | null; displayName: string | null } | null;
};

const parseFindings = (raw: string | null): ScanFinding[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** 管理者が個々のスキャン異議を裁定するカード */
const AppealCard = ({ row }: { row: AppealRow }) => {
  const t = useTranslations("Admin");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const findings = parseFindings(row.version.scanFindings);
  const appellantName = row.appellant?.displayName ?? row.appellant?.username ?? "Unknown";

  const review = async (decision: "approved" | "rejected") => {
    setBusy(true);
    const res = await reviewScanAppeal(row.appeal.id, decision, note);
    setBusy(false);
    if ("success" in res) setDone(decision);
  };

  if (done) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">
            {t(`appeals.reviewed.${done}`, { name: row.project.name })}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
          <Chip
            label={row.version.scanStatus}
            color={row.version.scanStatus === "malicious" ? "error" : "warning"}
            size="small"
          />
          <Typography variant="subtitle2">
            {row.project.name} v{row.version.versionNumber}
          </Typography>
          <Link href={`/projects/${row.project.slug}/versions/${row.version.id}`} style={{ fontSize: "0.8rem" }}>
            Link
          </Link>
        </Box>

        <Typography variant="caption" color="text.disabled">
          {t("appeals.appellant", { name: appellantName })}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, p: 1.5, bgcolor: "background.default", borderRadius: 1, border: "1px solid", borderColor: "divider", whiteSpace: "pre-wrap" }}
        >
          {row.appeal.reason}
        </Typography>

        {findings.length > 0 && (
          <Box component="ul" sx={{ mt: 1, mb: 0, pl: 2 }}>
            {findings.map((f, i) => (
              <li key={i}>
                <Typography variant="caption">{f.rule} — {f.target}</Typography>
              </li>
            ))}
          </Box>
        )}

        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          sx={{ mt: 2 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("appeals.notePlaceholder")}
        />

        <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "flex-end" }}>
          <Button size="small" color="inherit" disabled={busy} onClick={() => review("rejected")}>
            {t("appeals.reject")}
          </Button>
          <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => review("approved")}>
            {t("appeals.approve")}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AppealCard;
