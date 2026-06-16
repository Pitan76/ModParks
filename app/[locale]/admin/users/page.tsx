import { getDatabase } from "@/lib/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import UsersClient from "./UsersClient";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.users");

  const db = await getDatabase();
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).all();

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <UsersClient users={allUsers} />
    </>
  );
}
