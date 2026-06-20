"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { createProject } from "@/lib/actions/project";
import ProjectFormFields from "@/components/project/ProjectFormFields";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

export default function NewProjectForm({ availableTags, defaultLicense, ideaId, hasModrinthKey, hasCurseForgeKey }: { availableTags: any[], defaultLicense?: string, ideaId?: string, hasModrinthKey?: boolean, hasCurseForgeKey?: boolean }) {
  const router = useRouter();
  const t = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const [tabIndex, setTabIndex] = useState(0);
  const [importPlatform, setImportPlatform] = useState<"modrinth"|"curseforge">("modrinth");
  const [importId, setImportId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importData, setImportData] = useState<any>(null);
  const [formKey, setFormKey] = useState(0);

  const handleImport = async () => {
    if (!importId) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch(`/api/v1/projects/import?platform=${importPlatform}&id=${importId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setImportData(data);
      setFormKey(k => k + 1);
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // API呼び出しに変更（CloudflareのServer Action + next-intlバグ回避のため）
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });
      const result = (await res.json()) as { error?: any, slug?: string };
      
      if (!res.ok) {
        if (result.error) {
          setError(result.error as { [key: string]: string[] });
        } else {
          console.error(result);
          setError({ _form: ["Failed to create project"] });
        }
        setPending(false);
      } else {
        // 成功したらリダイレクト
        router.push(`/${locale}/projects/${result.slug}`);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError({ _form: ["An unexpected error occurred"] });
      setPending(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {t("create.title")}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs value={tabIndex} onChange={(_, val) => setTabIndex(val)}>
          <Tab label="通常作成" />
          <Tab label="外部からインポート" />
        </Tabs>
      </Box>

      {tabIndex === 1 && (
        <Card sx={{ mb: 4, bgcolor: "background.default" }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>外部プロジェクトからデータを取得</Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Platform</InputLabel>
                <Select value={importPlatform} label="Platform" onChange={(e) => setImportPlatform(e.target.value as any)}>
                  <MenuItem value="modrinth">Modrinth</MenuItem>
                  <MenuItem value="curseforge">CurseForge</MenuItem>
                </Select>
              </FormControl>
              <TextField 
                label={importPlatform === "modrinth" ? "Project ID / Slug" : "Project ID"} 
                size="small" 
                value={importId} 
                onChange={(e) => setImportId(e.target.value)} 
                sx={{ flex: 1 }}
              />
              <Button variant="contained" onClick={handleImport} disabled={importing || !importId}>
                {importing ? <CircularProgress size={24} /> : "データ取得"}
              </Button>
            </Box>
            {importPlatform === "modrinth" && !hasModrinthKey && (
              <Alert severity="warning" sx={{ mt: 2 }}>ModrinthのAPIキーが設定されていません。非公開プロジェクトを取得するにはアカウント設定からAPIキーを登録してください。</Alert>
            )}
            {importPlatform === "curseforge" && !hasCurseForgeKey && (
              <Alert severity="warning" sx={{ mt: 2 }}>CurseForgeのAPIキーが設定されていません。取得に失敗する場合はアカウント設定からAPIキーを登録してください。</Alert>
            )}
            {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
            {importData && <Alert severity="success" sx={{ mt: 2 }}>データを取得しました。フォームに反映されました。</Alert>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {ideaId && <input type="hidden" name="ideaId" value={ideaId} />}
            {importData?.modrinthId && <input type="hidden" name="modrinthId" value={importData.modrinthId} />}
            {importData?.curseforgeId && <input type="hidden" name="curseforgeId" value={importData.curseforgeId} />}
            {importData?.externalDownloads !== undefined && <input type="hidden" name="externalDownloads" value={importData.externalDownloads} />}
            {importData?.issueTrackerUrl && <input type="hidden" name="issueTrackerUrl" value={importData.issueTrackerUrl} />}

            <ProjectFormFields key={formKey} error={error} project={importData || undefined} availableTags={availableTags} defaultLicense={defaultLicense} />

            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" variant="contained" disabled={pending}>
                {pending ? t("create.creating") : t("create.submit")}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}
