import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import {
  countTrustList,
  getTrustDistribution,
  getTrustList,
  TRUST_PAGE_SIZE,
  type TrustFilter,
} from "@/lib/queries/adminTrust";
import TrustListTable from "@/components/admin/TrustListTable";
import StatusFilterTabs from "@/components/admin/StatusFilterTabs";
import PaginationControls from "@/components/ui/PaginationControls";
import { redirect } from "@/lib/i18n/routing";

const FILTERS: TrustFilter[] = [
  "all", "restricted", "new", "member", "trusted", "veteran", "frozen", "overridden",
];

interface AdminTrustPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; page?: string; q?: string }>;
}

function toFilter(raw: string | undefined): TrustFilter {
  return FILTERS.includes(raw as TrustFilter) ? (raw as TrustFilter) : "all";
}

function toPage(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

export default async function AdminTrustPage({ params, searchParams }: AdminTrustPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect({ href: "/", locale: locale });
  }

  const t = await getTranslations("Admin");
  const query = await searchParams;
  const filter = toFilter(query.status);
  const page = toPage(query.page);

  const [rows, distribution, totalCount] = await Promise.all([
    getTrustList(filter, page, query.q),
    getTrustDistribution(),
    countTrustList(filter, query.q),
  ]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>{t("trust.listTitle")}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("trust.description")}
      </Typography>

      {/* 数値が独り歩きして「スコアが低い人は怪しい」運用になるのを防ぐ */}
      <Alert severity="info" sx={{ mb: 3 }}>{t("trust.disclaimer")}</Alert>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{t("trust.distribution")}</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {Object.entries(distribution).map(([tier, count]) => (
            <Chip key={tier} size="small" label={`${t(`trust.filters.${tier}`)}: ${count}`} />
          ))}
        </Box>
      </Box>

      <StatusFilterTabs
        basePath="/admin/trust"
        active={filter}
        options={FILTERS.map((value) => ({ value, label: t(`trust.filters.${value}`) }))}
      />

      <TrustListTable rows={rows} locale={locale} />

      <PaginationControls
        totalCount={totalCount}
        currentPage={page}
        currentLimit={TRUST_PAGE_SIZE}
        sx={{ mt: 3 }}
      />
    </Box>
  );
}
