import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import LinkButton from "@/components/ui/LinkButton";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FlagIcon from "@mui/icons-material/Flag";
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { getAdminStats, type AdminStats } from "@/lib/queries/adminDashboard";
import Link from "next/link";

interface AdminDashboardProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminDashboardPage({ params }: AdminDashboardProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect("/");
  }

  const tAdmin = await getTranslations("Admin");
  const stats = await getAdminStats();

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {tAdmin("title")}
      </Typography>

      <StatsSection stats={stats} tAdmin={tAdmin} />

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        {tAdmin("dashboard.sections.contents")}
      </Typography>
      <ToolGrid items={getContentTools()} tAdmin={tAdmin} />

      <Typography variant="h5" sx={{ fontWeight: 700, mt: 6, mb: 3 }}>
        {tAdmin("dashboard.sections.system")}
      </Typography>
      <ToolGrid items={getSystemTools()} tAdmin={tAdmin} />
    </Box>
  );
}

function StatsSection({ stats, tAdmin }: { stats: AdminStats; tAdmin: any }) {
  const items = [
    { id: "rep", label: tAdmin("dashboard.statsPendingReports"), val: stats.pendingReports, path: "/admin/reports", col: stats.pendingReports > 0 ? "error.main" : "success.main" },
    { id: "app", label: tAdmin("dashboard.statsPendingAppeals"), val: stats.pendingAppeals, path: "/admin/appeals", col: stats.pendingAppeals > 0 ? "warning.main" : "success.main" },
    { id: "usr", label: tAdmin("dashboard.statsTotalUsers"), val: stats.totalUsers, path: "/admin/users", col: "primary.main" },
    { id: "prj", label: tAdmin("dashboard.statsTotalProjects"), val: stats.totalProjects, path: "/admin/projects", col: "info.main" },
  ];

  return (
    <Grid container spacing={3}>
      {items.map((item) => (
        <Grid key={item.id} size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            component={Link}
            href={item.path}
            sx={{
              textDecoration: "none",
              color: "inherit",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": { transform: "translateY(-4px)", boxShadow: 4 },
              borderLeft: "6px solid",
              borderColor: item.col,
            }}
          >
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                {item.label}
              </Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, mt: 1, color: item.id === "rep" && item.val > 0 ? "error.main" : "text.primary" }}>
                {item.val}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

interface ToolItem {
  titleKey: string;
  descKey: string;
  btnKey: string;
  href: string;
  icon: React.ReactNode;
  variant?: "contained" | "outlined";
}

function ToolGrid({ items, tAdmin }: { items: ToolItem[]; tAdmin: any }) {
  return (
    <Grid container spacing={3}>
      {items.map((item) => (
        <Grid key={item.href} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack spacing={2}>
                {item.icon}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{tAdmin(item.titleKey)}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{tAdmin(item.descKey)}</Typography>
                </Box>
              </Stack>
            </CardContent>
            <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end", mt: "auto" }}>
              <LinkButton variant={item.variant ?? "outlined"} href={item.href}>
                {tAdmin(item.btnKey)}
              </LinkButton>
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

const getContentTools = (): ToolItem[] => [
  { titleKey: "reports.title", descKey: "reports.description", btnKey: "reports.viewList", href: "/admin/reports", icon: <FlagIcon sx={{ fontSize: 40, color: "error.main" }} />, variant: "contained" },
  { titleKey: "recipe.cardTitle", descKey: "recipe.cardDesc", btnKey: "sidebar.recipe", href: "/admin/recipe", icon: <MenuBookIcon sx={{ fontSize: 40, color: "warning.main" }} /> }
];

const getSystemTools = (): ToolItem[] => [
  { titleKey: "config.title", descKey: "config.tagsDesc", btnKey: "sidebar.config", href: "/admin/config", icon: <AssessmentIcon sx={{ fontSize: 40, color: "primary.main" }} /> },
  { titleKey: "oauth.title", descKey: "oauth.cardDesc", btnKey: "sidebar.oauth", href: "/admin/oauth", icon: <VpnKeyIcon sx={{ fontSize: 40, color: "info.main" }} /> },
  { titleKey: "audit.title", descKey: "audit.description", btnKey: "sidebar.audit", href: "/admin/logs", icon: <HistoryIcon sx={{ fontSize: 40, color: "success.main" }} /> }
];
