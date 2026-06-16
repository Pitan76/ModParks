import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import PeopleIcon from "@mui/icons-material/People";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReportIcon from "@mui/icons-material/Report";
import SettingsIcon from "@mui/icons-material/Settings";

const DRAWER_WIDTH = 240;

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
