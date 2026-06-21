import { getDatabase } from "@/lib/db";
import { users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import UsersClient from "./UsersClient";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.users");

  const db = await getDatabase();
  const { isNull } = await import("drizzle-orm");
  const allUsers = await db.select({
      id: users.id,
      username: userProfiles.username,
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt
  }).from(users).leftJoin(userProfiles, eq(users.id, userProfiles.userId)).orderBy(desc(users.createdAt)).all() as any[];

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <UsersClient users={allUsers} />
    </>
  );
}
