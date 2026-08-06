import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { Link } from "@/lib/i18n/routing";
import { tableContainerSx, tableHeadSx, tableRootSx, TABLE_MIN_WIDTH } from "@/components/ui/tableStyles";
import ScanOverrideDialog from "@/components/admin/ScanOverrideDialog";
import type { ScanLogRow } from "@/lib/queries/adminScans";

type ScanLogTableProps = {
  rows: ScanLogRow[];
  labels: {
    version: string;
    status: string;
    findings: string;
    scannedAt: string;
    appeal: string;
    actions: string;
    notScanned: string;
    empty: string;
    noFindings: string;
  };
};

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "info",
  clean: "success",
  suspicious: "warning",
  malicious: "error",
  skipped: "default",
  failed: "warning",
};

/** 管理者が判定を付け替えられる状態。未スキャン・対象外は対象外とする */
const OVERRIDABLE_STATUSES = new Set(["clean", "suspicious", "malicious", "failed"]);

/** scan_findings は JSON 文字列。壊れていても行の描画は止めない */
function summarizeFindings(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((f) => `${f?.rule ?? "unknown"}: ${f?.target ?? ""}`);
  } catch {
    return [];
  }
}

/** スキャン結果の一覧表。判定と検出内容、異議の有無をまとめて見せる */
export default function ScanLogTable({ rows, labels }: ScanLogTableProps) {
  if (rows.length === 0) {
    return <Typography color="text.secondary">{labels.empty}</Typography>;
  }

  return (
    <TableContainer component={Paper} sx={tableContainerSx}>
      <Table sx={[tableRootSx, { minWidth: TABLE_MIN_WIDTH }]}>
        <TableHead sx={tableHeadSx}>
          <TableRow>
            <TableCell>{labels.version}</TableCell>
            <TableCell>{labels.status}</TableCell>
            <TableCell>{labels.findings}</TableCell>
            <TableCell>{labels.scannedAt}</TableCell>
            <TableCell>{labels.appeal}</TableCell>
            <TableCell>{labels.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const findings = summarizeFindings(row.scanFindings);
            return (
              <TableRow key={row.versionId} hover>
                <TableCell>
                  <Link href={`/projects/${row.projectSlug}/versions/${row.versionId}`} style={{ textDecoration: "none" }}>
                    {row.projectName} v{row.versionNumber}
                  </Link>
                  <Typography variant="caption" color="text.disabled" sx={{ display: "block" }}>
                    {row.fileName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={row.scanStatus} size="small" color={STATUS_COLORS[row.scanStatus] ?? "default"} />
                </TableCell>
                <TableCell>
                  {findings.length === 0 ? (
                    <Typography variant="caption" color="text.disabled">{labels.noFindings}</Typography>
                  ) : (
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {findings.map((text, i) => {
                        const isError = text.startsWith("scan_error:");
                        return (
                          <li key={i}>
                            <Typography variant="caption" color={isError ? "error.main" : "text.primary"}>
                              {text}
                            </Typography>
                          </li>
                        );
                      })}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {row.scanAt ? new Date(row.scanAt).toISOString().replace("T", " ").slice(0, 16) : labels.notScanned}
                  </Typography>
                </TableCell>
                <TableCell>
                  {row.appealStatus ? <Chip label={row.appealStatus} size="small" variant="outlined" /> : "-"}
                </TableCell>
                <TableCell>
                  {/* スキャン済みの行だけ付け替えられる。未スキャン・対象外は覆す判定が無い */}
                  {OVERRIDABLE_STATUSES.has(row.scanStatus) ? (
                    <ScanOverrideDialog
                      versionId={row.versionId}
                      currentStatus={row.scanStatus}
                      hasPendingAppeal={row.appealStatus === "pending"}
                    />
                  ) : "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
