import { getAdminDb } from "@/lib/auth-helpers";
import Typography from "@mui/material/Typography";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isChreeIdProvisioningEnabled } from "@/lib/chreeid/client";
import { CHREEID_BATCH_SIZE, countChreeIdPending } from "@/lib/chreeid/bulkMigration";
import ChreeIdMigrationClient from "./ChreeIdMigrationClient";

export default async function AdminChreeIdPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Admin.chreeid");

  const { db } = await getAdminDb();
  const enabled = isChreeIdProvisioningEnabled();
  const counts = enabled ? await countChreeIdPending(db) : { total: 0, pending: 0 };

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>{t("title")}</Typography>
      <ChreeIdMigrationClient enabled={enabled} total={counts.total} pending={counts.pending} batchSize={CHREEID_BATCH_SIZE} />
    </>
  );
}
