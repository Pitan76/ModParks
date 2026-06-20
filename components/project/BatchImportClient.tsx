"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import { fetchModrinthProjects, importProjectsFromModrinth } from "@/lib/actions/import";

interface BatchImportClientProps {
  hasModrinthKey: boolean;
  hasCurseForgeKey: boolean;
}

export default function BatchImportClient({ hasModrinthKey, hasCurseForgeKey }: BatchImportClientProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFetchModrinth = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const fetched = await fetchModrinthProjects();
      setProjects(fetched);
      setSelected(new Set(fetched.map((p: any) => p.id)));
    } catch (err: any) {
      setError(err.message || "Failed to fetch Modrinth projects");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleToggleAll = () => {
    if (selected.size === projects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map(p => p.id)));
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const toImport = projects.filter(p => selected.has(p.id));
      const res = await importProjectsFromModrinth(toImport);
      if (res.success) {
        setSuccessMsg(`Successfully imported ${res.importedCount} projects.`);
        setProjects([]);
        setSelected(new Set());
      }
    } catch (err: any) {
      setError(err.message || "Failed to import projects");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        連携済みの外部サービスからプロジェクトを一括インポートします。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }}>{successMsg}</Alert>}

      <Box sx={{ mb: 4, display: "flex", gap: 2 }}>
        <Button 
          variant="contained" 
          onClick={handleFetchModrinth} 
          disabled={!hasModrinthKey || loading || importing}
        >
          {loading ? <CircularProgress size={24} /> : "Modrinthから取得"}
        </Button>
        {!hasModrinthKey && (
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            ※アカウント設定でAPIキーを登録してください
          </Typography>
        )}
      </Box>

      {projects.length > 0 && (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < projects.length}
                      checked={selected.size > 0 && selected.size === projects.length}
                      onChange={handleToggleAll}
                    />
                  </TableCell>
                  <TableCell>プロジェクト名</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>種類</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((p) => (
                  <TableRow key={p.id} hover onClick={() => handleToggle(p.id)} sx={{ cursor: "pointer" }}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.has(p.id)} />
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.slug}</TableCell>
                    <TableCell>{p.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleImport} 
            disabled={selected.size === 0 || importing}
          >
            {importing ? "インポート中..." : `${selected.size}件をインポート`}
          </Button>
        </>
      )}
    </Box>
  );
}
