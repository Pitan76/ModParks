import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getScanAppeals, getScanAppealCounts, type ScanAppealFilter } from "@/lib/actions/scanAppeal";
import AppealCard from "@/components/admin/AppealCard";
import StatusFilterTabs from "@/components/admin/StatusFilterTabs";

const FILTERS: ScanAppealFilter[] = ["pending", "approved", "rejected", "all"];

interface AdminAppealsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}

/** 未知の status で意図しない一覧を出さないよう、既知の値以外は既定へ倒す */
function toFilter(raw: string | undefined): ScanAppealFilter {
  return FILTERS.includes(raw as ScanAppealFilter) ? (raw as ScanAppealFilter) : "pending";
}

export default async function AdminAppealsPage({ params, searchParams }: AdminAppealsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect("/");
  }

  const tAdmin = await getTranslations("Admin");
  const filter = toFilter((await searchParams).status);

  const [appeals, counts] = await Promise.all([getScanAppeals(filter), getScanAppealCounts()]);

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {tAdmin("appeals.listTitle")}
      </Typography>

      <StatusFilterTabs
        basePath="/admin/appeals"
        active={filter}
        options={FILTERS.map((value) => ({
          value,
          label: tAdmin(`appeals.filters.${value}`),
          count: counts[value],
        }))}
      />

      <Stack spacing={2}>
        {appeals.length === 0 && (
          <Typography color="text.secondary">{tAdmin("appeals.empty")}</Typography>
        )}
        {appeals.map((row) => (
          <AppealCard key={row.appeal.id} row={row} />
        ))}
      </Stack>
    </Box>
  );
}
