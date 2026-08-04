import { getAdminDb } from "@/lib/auth-helpers";
import { oauthClients, users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Typography from "@mui/material/Typography";
import OauthClient from "./OauthClient";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminOauthPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.oauth");

  const { db } = await getAdminDb();
  
  // OAuth クライアントと所有者ユーザーのプロフィールを取得
  const clients = await db.select({
    id: oauthClients.id,
    name: oauthClients.name,
    description: oauthClients.description,
    logoUrl: oauthClients.logoUrl,
    homepageUrl: oauthClients.homepageUrl,
    redirectUris: oauthClients.redirectUris,
    scopes: oauthClients.scopes,
    isConfidential: oauthClients.isConfidential,
    isTrusted: oauthClients.isTrusted,
    disabledAt: oauthClients.disabledAt,
    createdAt: oauthClients.createdAt,
    owner: {
      id: users.id,
      displayName: userProfiles.displayName,
      username: userProfiles.username,
      avatarUrl: userProfiles.avatarUrl,
    }
  })
  .from(oauthClients)
  .innerJoin(users, eq(oauthClients.ownerUserId, users.id))
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .orderBy(desc(oauthClients.createdAt))
  .all() as any[];

  return (
    <>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <OauthClient clients={clients} />
    </>
  );
}
