import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { getAdminDb } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { unpublishProject, updateReportStatus, getReports, deleteCommentAction, suspendUserFromReport } from "@/lib/actions/report";

interface AdminReportsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminReportsPage({ params }: AdminReportsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  try {
    await getAdminDb();
  } catch (e) {
    redirect("/");
  }

  const tAdmin = await getTranslations("Admin");
  const reports = await getReports();

  const reasonLabels: Record<string, string> = {
    copyright:  tAdmin("reports.reasons.copyright"),
    malware:    tAdmin("reports.reasons.malware"),
    spam:       tAdmin("reports.reasons.spam"),
    harassment: tAdmin("reports.reasons.harassment"),
    other:      tAdmin("reports.reasons.other"),
  };

  const statusColors: Record<string, "warning" | "success" | "default"> = {
    pending:   "warning",
    resolved:  "success",
    dismissed: "default",
  };

  const statusLabels: Record<string, string> = {
    pending:   tAdmin("reports.status.pending"),
    resolved:  tAdmin("reports.status.resolved"),
    dismissed: tAdmin("reports.status.dismissed"),
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800,  mb: 4  }}>
        {tAdmin("reports.listTitle")}
      </Typography>

      <Stack spacing={2}>
        {reports.length === 0 && (
          <Typography color="text.secondary">{tAdmin("reports.noReports")}</Typography>
        )}
        {reports.map(({ report, project, idea, comment, reportedUser, reporter }) => {
          const renderTargetInfo = () => {
            if (report.targetType === "project" && project?.id) {
              return (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {tAdmin("reports.project", { name: project.name })}
                  </Typography>
                  <Link href={`/projects/${project.slug}`} style={{ fontSize: "0.875rem" }}>
                    Link
                  </Link>
                </Box>
              );
            }

            if (report.targetType === "idea" && idea?.id) {
              return (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {tAdmin("reports.idea", { name: idea.name })}
                  </Typography>
                  <Link href={`/ideas/${idea.id}`} style={{ fontSize: "0.875rem" }}>
                    Link
                  </Link>
                </Box>
              );
            }

            if (report.targetType === "comment" && comment?.id && comment.content) {
              const postLink = comment.postKind === "project"
                ? `/projects/${comment.postSlug ?? ""}`
                : `/ideas/${comment.postId ?? ""}`;
              const displayContent = comment.content.length > 50
                ? comment.content.substring(0, 50) + "..."
                : comment.content;
              return (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      {tAdmin("reports.comment", { content: displayContent })}
                    </Typography>
                    <Link href={postLink} style={{ fontSize: "0.875rem" }}>
                      Link
                    </Link>
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                    Parent: {comment.postTitle ?? "Unknown"} ({comment.postKind ?? "Unknown"})
                  </Typography>
                </Box>
              );
            }

            if (report.targetType === "user" && reportedUser?.id) {
              return (
                <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    {tAdmin("reports.user", { name: reportedUser.displayName ?? reportedUser.username ?? "Unknown" })}
                  </Typography>
                  <Link href={`/profile/${reportedUser.username}`} style={{ fontSize: "0.875rem" }}>
                    Link
                  </Link>
                </Box>
              );
            }

            return null;
          };

          return (
            <Card key={report.id} id={`report-card-${report.id}`}>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
                  {/* 左: 通報情報 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                      <Chip
                        label={reasonLabels[report.reason]}
                        color="error"
                        size="small"
                      />
                      <Chip
                        label={statusLabels[report.status]}
                        color={statusColors[report.status]}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.disabled">
                        {new Date(report.createdAt).toLocaleDateString("ja-JP")}
                      </Typography>
                    </Box>

                    {renderTargetInfo()}

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {tAdmin("reports.reporter", { name: reporter?.displayName ?? reporter?.username ?? "Unknown" })}
                    </Typography>

                    {report.detail && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1,
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
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-end" }}>
                      <form action={updateReportStatus.bind(null, report.id, "resolved") as any}>
                        <Button
                          type="submit"
                          variant="outlined"
                          size="small"
                          color="success"
                        >
                          {tAdmin("reports.actions.resolve")}
                        </Button>
                      </form>

                      {report.targetType === "project" && project?.id && (
                        <form action={unpublishProject.bind(null, project.id) as any}>
                          <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            color="error"
                          >
                            {tAdmin("reports.actions.unpublish")}
                          </Button>
                        </form>
                      )}

                      {report.targetType === "idea" && idea?.id && (
                        <form action={unpublishProject.bind(null, idea.id) as any}>
                          <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            color="error"
                          >
                            {tAdmin("reports.actions.unpublish")}
                          </Button>
                        </form>
                      )}

                      {report.targetType === "comment" && comment?.id && (
                        <form action={deleteCommentAction.bind(null, comment.id) as any}>
                          <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            color="error"
                          >
                            {tAdmin("reports.actions.deleteComment")}
                          </Button>
                        </form>
                      )}

                      {report.targetType === "user" && reportedUser?.id && (
                        <form action={suspendUserFromReport.bind(null, reportedUser.id) as any}>
                          <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            color="error"
                          >
                            {tAdmin("reports.actions.suspendUser")}
                          </Button>
                        </form>
                      )}

                      <form action={updateReportStatus.bind(null, report.id, "dismissed") as any}>
                        <Button
                          type="submit"
                          variant="text"
                          size="small"
                          color="inherit"
                        >
                          {tAdmin("reports.actions.dismiss")}
                        </Button>
                      </form>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
