import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { unpublishProject, updateReportStatus, getReports } from "@/lib/actions/report";

interface AdminReportsPageProps {
  params: Promise<{ locale: string }>;
}

const REASON_LABEL: Record<string, string> = {
  copyright: "著作権侵害",
  malware:   "マルウェア疑い",
  spam:      "スパム",
  other:     "その他",
};

const STATUS_COLOR: Record<string, "warning" | "success" | "default"> = {
  pending:   "warning",
  resolved:  "success",
  dismissed: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "未対応",
  resolved:  "対応済",
  dismissed: "却下",
};

export default async function AdminReportsPage({ params }: AdminReportsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/");

  const reports = await getReports();

  return (
    <Container maxWidth="lg" sx={{ py: 5 }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 4 }}>
        通報一覧
      </Typography>

      <Stack spacing={2}>
        {reports.length === 0 && (
          <Typography color="text.secondary">現在のところ通報はありません。</Typography>
        )}
        {reports.map(({ report, project, reporter }) => (
          <Card key={report.id} id={`report-card-${report.id}`}>
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                {/* 左: 通報情報 */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                    <Chip
                      label={REASON_LABEL[report.reason]}
                      color="error"
                      size="small"
                    />
                    <Chip
                      label={STATUS_LABEL[report.status]}
                      color={STATUS_COLOR[report.status]}
                      size="small"
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.disabled">
                      {new Date(report.createdAt).toLocaleDateString("ja-JP")}
                    </Typography>
                  </Box>

                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    プロジェクト: {project.name}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    通報者: {reporter.displayName ?? reporter.username}
                  </Typography>

                  {report.detail && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        p: 1.5,
                        bgcolor: "background.default",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    >
                      {report.detail}
                    </Typography>
                  )}
                </Box>

                {/* 右: アクション */}
                {report.status === "pending" && (
                  <Stack spacing={1} alignItems="flex-end">
                    <form action={updateReportStatus.bind(null, report.id, "resolved")}>
                      <Button
                        id={`resolve-btn-${report.id}`}
                        type="submit"
                        variant="contained"
                        size="small"
                        color="success"
                      >
                        対応済
                      </Button>
                    </form>
                    <form action={unpublishProject.bind(null, project.id)}>
                      <Button
                        id={`unpublish-btn-${project.id}`}
                        type="submit"
                        variant="outlined"
                        size="small"
                        color="error"
                      >
                        非公開にする
                      </Button>
                    </form>
                    <form action={updateReportStatus.bind(null, report.id, "dismissed")}>
                      <Button
                        id={`dismiss-btn-${report.id}`}
                        type="submit"
                        variant="text"
                        size="small"
                        color="inherit"
                      >
                        却下
                      </Button>
                    </form>
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
