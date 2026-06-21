import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Box from "@mui/material/Box";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  
  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=/${locale}/admin`);
  }
  if (session.user.role !== "admin") {
    redirect(`/${locale}`);
  }

  // Check if admin has set a password for security
  const { getDatabase } = await import("@/lib/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const db = await getDatabase();
  const currentUser = await db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (currentUser && !currentUser.passwordHash) {
    redirect(`/${locale}/settings?error=admin_password_required`);
  }

  return (
    <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, overflow: "auto", height: "100%" }}>
      {children}
    </Box>
  );
}
