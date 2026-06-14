import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import AssessmentIcon from "@mui/icons-material/Assessment";
import FlagIcon from "@mui/icons-material/Flag";

interface AdminDashboardProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminDashboardPage({ params }: AdminDashboardProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  const tAdmin = await getTranslations("Admin");

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        {tAdmin("title")}
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card id="admin-reports-card">
            <CardContent>
              <Stack spacing={2}>
                <FlagIcon sx={{ fontSize: 40, color: "error.main" }} />
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{tAdmin("reports.title")}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {tAdmin("reports.description")}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <LinkButton variant="contained" href="/admin/reports">
                    {tAdmin("reports.viewList")}
                  </LinkButton>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
