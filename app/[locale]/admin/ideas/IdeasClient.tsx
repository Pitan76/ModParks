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
import IconButton from "@mui/material/IconButton";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Link } from "@/lib/i18n/routing";
import { adminDeleteIdea } from "@/lib/actions/admin";
import { useTranslations } from "next-intl";
import { tableContainerSx, tableHeadSx, tableRootSx, TABLE_MIN_WIDTH } from "@/components/ui/tableStyles";

interface AdminIdea {
  id: string;
  title: string;
  status: string;
  createdAt: Date | number;
  authorUsername: string | null;
  authorDisplayName: string | null;
}

export default function IdeasClient({ ideas }: { ideas: AdminIdea[] }) {
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const tAdmin = useTranslations("Admin.ideas");

  const handleDeleteIdea = async (ideaId: string) => {
    if (!confirm(tAdmin("deleteConfirm"))) return;
    try {
      await adminDeleteIdea(ideaId);
      setMsg({ type: "success", text: tAdmin("successDelete") });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <Box>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <TableContainer component={Paper} sx={tableContainerSx}>
        <Table size="small" sx={[tableRootSx, { minWidth: TABLE_MIN_WIDTH }]}>
          <TableHead sx={tableHeadSx}>
            <TableRow>
              <TableCell>{tAdmin("titleName")}</TableCell>
              <TableCell>{tAdmin("status")}</TableCell>
              <TableCell>{tAdmin("author")}</TableCell>
              <TableCell>{tAdmin("created")}</TableCell>
              <TableCell align="right">{tAdmin("actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ideas.map((idea) => {
              const createdDate = new Date(typeof idea.createdAt === "number" ? idea.createdAt * 1000 : idea.createdAt);
              return (
                <TableRow key={idea.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      {idea.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {idea.status}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Link href={`/profile/${idea.authorUsername}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <Typography variant="body2" sx={{ "&:hover": { textDecoration: "underline" } }}>
                        {idea.authorDisplayName || idea.authorUsername}
                      </Typography>
                    </Link>
                  </TableCell>
                  <TableCell>{createdDate.toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton component={Link} href={`/ideas/${idea.id}`} color="primary" title="View Idea">
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteIdea(idea.id)} title="Delete Idea">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
            {ideas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">{tAdmin("noIdeas")}</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
