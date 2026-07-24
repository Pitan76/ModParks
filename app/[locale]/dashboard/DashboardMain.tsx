import { getTranslations } from "next-intl/server";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import FolderIcon from "@mui/icons-material/Folder";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Link from "next/link";
import LinkButton from "@/components/ui/LinkButton";
import type { DashboardData } from "./dashboardData";
import { getProjectStatusColor, getIdeaStatusColor } from "./statusColors";

function SectionHeader({
  icon,
  title,
  href,
  viewAll,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  viewAll: string;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
      <Typography
        variant="h5"
        sx={{ fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.5rem" }, display: "flex", alignItems: "center", minWidth: 0 }}
      >
        {icon}
        {title}
      </Typography>
      <LinkButton href={href} variant="text" endIcon={<ChevronRightIcon />} sx={{ fontWeight: "bold" }}>
        {viewAll}
      </LinkButton>
    </Box>
  );
}

type Props = {
  locale: string;
  recentProjects: DashboardData["recentProjects"];
  myIdeas: DashboardData["myIdeas"];
};

export default async function DashboardMain({ locale, recentProjects, myIdeas }: Props) {
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");

  return (
    <Grid size={{ xs: 12, lg: 8 }}>
      <Stack spacing={{ xs: 4, md: 6 }}>
        <Box>
          <SectionHeader
            icon={<FolderIcon sx={{ verticalAlign: "middle", mr: 1 }} />}
            title={tNav("myProjects")}
            href="/projects/manage"
            viewAll={t("viewAll")}
          />
          <Card sx={{ borderRadius: 3 }}>
            <TableContainer>
              <Table sx={{ minWidth: 480 }}>
                <TableHead sx={{ bgcolor: "action.hover" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>{t("table.projectName")}</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>{t("table.status")}</TableCell>
                    <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.downloads")}</TableCell>
                    <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.updated")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentProjects.length > 0 ? (
                    recentProjects.map((p) => (
                      <TableRow key={p.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell>
                          <Link href={`/projects/${p.slug}`} style={{ fontWeight: "bold", textDecoration: "none", color: "inherit" }}>
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip label={tCommon(`visibility.${p.status}`)} size="small" color={getProjectStatusColor(p.status)} />
                        </TableCell>
                        <TableCell align="right">{p.totalDownloads.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {new Date(p.updatedAt || p.createdAt || 0).toLocaleDateString(locale)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        {t("noProjects")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>

        <Box>
          <SectionHeader
            icon={<LightbulbIcon sx={{ verticalAlign: "middle", mr: 1 }} />}
            title={t("myIdeas")}
            href="/ideas?author=me"
            viewAll={t("viewAll")}
          />
          <Card sx={{ borderRadius: 3 }}>
            <TableContainer>
              <Table sx={{ minWidth: 420 }}>
                <TableHead sx={{ bgcolor: "action.hover" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>{t("table.ideaTitle")}</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>{t("table.status")}</TableCell>
                    <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>{t("table.created")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {myIdeas.length > 0 ? (
                    myIdeas.map((idea) => (
                      <TableRow key={idea.id} hover sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                        <TableCell>
                          <Link href={`/ideas/${idea.id}`} style={{ fontWeight: "bold", textDecoration: "none", color: "inherit" }}>
                            {idea.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={idea.status.replace("_", " ")}
                            size="small"
                            color={getIdeaStatusColor(idea.status)}
                            sx={{ textTransform: "capitalize" }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>
                          {new Date(idea.createdAt).toLocaleDateString(locale)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        {t("noIdeas")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      </Stack>
    </Grid>
  );
}
