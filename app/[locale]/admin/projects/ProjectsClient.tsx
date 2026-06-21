"use client";

import { useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link } from "@/i18n/routing";
import { adminDeleteProject } from "@/lib/actions/admin";
import TypedConfirmDialog from "@/components/ui/TypedConfirmDialog";

interface AdminProject {
  id: string;
  name: string;
  slug: string;
  createdAt: Date | number;
  authorUsername: string | null;
  authorDisplayName: string | null;
}

export default function ProjectsClient({ projects }: { projects: AdminProject[] }) {
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProject | null>(null);
  const [pending, setPending] = useState(false);

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await adminDeleteProject(deleteTarget.id);
      setMsg({ type: "success", text: "Project successfully deleted" });
      setDeleteTarget(null);
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setPending(false);
      setTimeout(() => setMsg(null), 3000);
    }
  };

  return (
    <Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Project Name</TableCell>
              <TableCell>Slug</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map((project) => {
              const createdDate = new Date(typeof project.createdAt === "number" ? project.createdAt * 1000 : project.createdAt);
              return (
                <TableRow key={project.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      {project.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {project.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Link href={`/profile/${project.authorUsername}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <Typography variant="body2" sx={{ "&:hover": { textDecoration: "underline" } }}>
                        {project.authorDisplayName || project.authorUsername}
                      </Typography>
                    </Link>
                  </TableCell>
                  <TableCell>{createdDate.toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton component={Link} href={`/projects/${project.slug}`} color="primary" title="View Project">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" onClick={() => setDeleteTarget(project)} title="Delete Project">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">No projects found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TypedConfirmDialog
        open={!!deleteTarget}
        onClose={() => !pending && setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description={<>Are you sure you want to completely delete the project <strong>{deleteTarget?.name}</strong>? This action cannot be undone and will delete all associated versions and files.</>}
        expectedValue={deleteTarget?.slug || ""}
        expectedValueLabel="Please type the project slug to confirm:"
        pending={pending}
      />
    </Box>
  );
}
