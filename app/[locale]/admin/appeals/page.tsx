import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getScanAppeals } from "@/lib/actions/scanAppeal";
import AppealCard from "@/components/admin/AppealCard";

interface AdminAppealsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminAppealsPage({ params }: AdminAppealsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch {
    redirect("/");
  }

  const tAdmin = await getTranslations("Admin");
  const appeals = await getScanAppeals("pending");

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {tAdmin("appeals.listTitle")}
      </Typography>

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
