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

  const tAdmin = await getTranslations("Admin");

  const menuItems = [
    { text: tAdmin("sidebar.dashboard"), icon: <DashboardIcon />, href: "/admin" },
    { text: tAdmin("sidebar.users"), icon: <PeopleIcon />, href: "/admin/users" },
    { text: tAdmin("sidebar.reports"), icon: <ReportIcon />, href: "/admin/reports" },
    { text: tAdmin("sidebar.config"), icon: <SettingsIcon />, href: "/admin/config" },
  ];

  return (
    <Box sx={{ display: "flex", flexGrow: 1, height: "100%", pt: 2, pb: 4 }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            position: "static", // Render naturally in the flex flow
            height: "100%",
            borderRight: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
            borderRadius: 2,
            overflow: "hidden"
          },
          display: { xs: "none", md: "block" }
        }}
      >
        <List sx={{ pt: 2 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <Link href={item.href} style={{ textDecoration: "none", color: "inherit", width: "100%" }}>
                <ListItemButton>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </Link>
            </ListItem>
          ))}
        </List>
        <Divider />
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, overflow: "auto" }}>
        {children}
      </Box>
    </Box>
  );
}
