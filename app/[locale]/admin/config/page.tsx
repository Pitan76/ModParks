import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getD1, getDb } from "@/lib/db";
import { tags, platforms } from "@/db/schema";
import ConfigClient from "./ConfigClient";

export default async function AdminConfigPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.config");

  const d1 = await getD1();
  const db = getDb(d1);

  const [allTags, allPlatforms] = await Promise.all([
    db.select().from(tags).all(),
    db.select().from(platforms).all(),
  ]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <ConfigClient initialTags={allTags} initialPlatforms={allPlatforms} />
    </Box>
  );
}
