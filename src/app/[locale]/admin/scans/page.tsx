import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import {
  getScanLogs,
  getScanLogCounts,
  getTopScanFindings,
  SCAN_LOG_PAGE_SIZE,
  type ScanLogFilter,
} from "@/lib/queries/adminScans";
import ScanLogTable from "@/components/admin/ScanLogTable";
import StatusFilterTabs from "@/components/admin/StatusFilterTabs";
import PaginationControls from "@/components/ui/PaginationControls";
import { redirect } from "@/lib/i18n/routing";

const FILTERS: ScanLogFilter[] = ["all", "pending", "clean", "suspicious", "malicious", "skipped", "failed"];

interface AdminScansPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}

function toFilter(raw: string | undefined): ScanLogFilter {
  return FILTERS.includes(raw as ScanLogFilter) ? (raw as ScanLogFilter) : "all";
}

function toPage(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export default async function AdminScansPage({ params, searchParams }: AdminScansPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect({ href: "/", locale: locale });
  }

  const tAdmin = await getTranslations("Admin");
  const query = await searchParams;
  const filter = toFilter(query.status);
  const page = toPage(query.page);

  const [rows, counts, topFindings] = await Promise.all([
    getScanLogs(filter, page),
    getScanLogCounts(),
    getTopScanFindings(),
  ]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{tAdmin("scans.listTitle")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{tAdmin("scans.description")}</Typography>

      <StatusFilterTabs
        basePath="/admin/scans"
        active={filter}
        options={FILTERS.map((value) => ({
          value,
          label: tAdmin(`scans.filters.${value}`),
          count: counts[value],
        }))}
      />

      {topFindings.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{tAdmin("scans.topFindings")}</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {topFindings.map((f) => <Chip key={f.rule} label={`${f.rule} (${f.hits})`} size="small" variant="outlined" />)}
          </Box>
        </Box>
      )}

      <ScanLogTable
        rows={rows}
        labels={{
          version: tAdmin("scans.columns.version"),
          status: tAdmin("scans.columns.status"),
          findings: tAdmin("scans.columns.findings"),
          scannedAt: tAdmin("scans.columns.scannedAt"),
          appeal: tAdmin("scans.columns.appeal"),
          actions: tAdmin("scans.columns.actions"),
          notScanned: tAdmin("scans.notScanned"),
          empty: tAdmin("scans.empty"),
          noFindings: tAdmin("scans.noFindings"),
        }}
      />

      <PaginationControls
        totalCount={counts[filter] ?? 0}
        currentPage={page}
        currentLimit={SCAN_LOG_PAGE_SIZE}
        sx={{ mt: 3 }}
      />
    </Box>
  );
}
