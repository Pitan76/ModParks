"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import { useTranslations, useLocale } from "next-intl";
import ProjectFormFields from "@/components/project/ProjectFormFields";
import ActionRow from "@/components/ui/ActionRow";
import SettingsLink from "@/components/ui/SettingsLink";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { parseJarFile } from "@/lib/utils/jarParser";
import type { ParsedModData } from "@/lib/utils/jarParser";
import { Link, useRouter } from "@/lib/i18n/routing";
import LinkButton from "@/components/ui/LinkButton";
import MuiLink from "@mui/material/Link";

export type NewProjectFormProps = {
  availableTags: { slug: string; name: string }[];
  defaultLicense?: string;
  defaultBodyFormat?: string;
  ideaId?: string;
  hasModrinthKey?: boolean;
  hasCurseForgeKey?: boolean;
};

/**
 * 新規プロジェクトを作成するための入力フォーム。
 * 通常の入力に加え、Modrinth/CurseForgeからのインポートや、JARファイルをアップロードしての自動メタデータ抽出に対応します。
 */
const NewProjectForm = ({
  availableTags,
  defaultLicense,
  defaultBodyFormat,
  ideaId,
  hasModrinthKey,
  hasCurseForgeKey
}: NewProjectFormProps) => {
  const router = useRouter();
  const t = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const tSettings = useTranslations("Settings");
  const tError = useTranslations("ServerErrors");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const [tabIndex, setTabIndex] = useState(0);
  const [importPlatform, setImportPlatform] = useState<"modrinth"|"curseforge">("modrinth");
  const [importId, setImportId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importData, setImportData] = useState<ParsedModData | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [jarImporting, setJarImporting] = useState(false);
  const [jarError, setJarError] = useState("");
  const [jarData, setJarData] = useState<ParsedModData | null>(null);

  const integrationSettingsLink = (
    <SettingsLink href="/settings/integration" label={tSettings("integration.title")} color="inherit" />
  );

  const handleImport = async () => {
    if (!importId) return;
    setImporting(true);
    setImportError("");
    try {
      const res = await fetch(`/api/v1/projects/import?platform=${importPlatform}&id=${encodeURIComponent(importId)}`);
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Import failed");
      
      if (data.projectUrl) {
        data.links = JSON.stringify([
          { title: importPlatform === "modrinth" ? "Modrinth" : "CurseForge", url: data.projectUrl }
        ]);
      }

      setImportData(data);
      setFormKey(k => k + 1);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleJarSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJarImporting(true);
    setJarError("");
    setJarData(null);
    try {
      const parsed = await parseJarFile(file, t("create.jar.fetchError"));
      if (parsed) {
        setImportData(parsed);
        setJarData(parsed);
        setFormKey(k => k + 1);
      } else {
        throw new Error(t("create.jar.fetchError"));
      }
    } catch (err: unknown) {
      console.error(err);
      setJarError(err instanceof Error ? err.message : t("create.jar.fetchError"));
    } finally {
      setJarImporting(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
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
          setError({ _form: [tError("project.createFailed")] });
        }
        setPending(false);
      } else {
        router.push(`/${locale}/projects/${result.slug}`);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      setError({ _form: [tError("common.serverError")] });
      setPending(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {t("create.title")}
        </Typography>
        <LinkButton href="/projects/import" variant="outlined" color="primary">
          {t("batchImportTitle")}
        </LinkButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 4 }}>
        <Tabs 
          value={tabIndex} 
          onChange={(_, val) => setTabIndex(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            maxWidth: { xs: 'calc(100vw - 32px)', sm: '100%' },
            '& .MuiTab-root': {
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }
          }}
        >
          <Tab label={t("create.tabs.normal")} />
          <Tab label={t("create.tabs.import")} />
          <Tab label={t("create.tabs.jar")} />
        </Tabs>
      </Box>

      {tabIndex === 1 && (
        <Card sx={{ mb: 4, bgcolor: "background.default" }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t("create.import.title")}</Typography>
            <ActionRow align="center" wrap>
              <FormControl size="small" sx={{ flex: "1 1 120px" }}>
                <InputLabel>{t("create.import.platform")}</InputLabel>
                <Select value={importPlatform} label={t("create.import.platform")} onChange={(e) => setImportPlatform(e.target.value as any)}>
                  <MenuItem value="modrinth">Modrinth</MenuItem>
                  <MenuItem value="curseforge">CurseForge</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={t("create.import.idLabel")}
                size="small"
                value={importId}
                onChange={(e) => setImportId(e.target.value)}
                sx={{ flex: "2 1 200px" }}
              />
              <Button variant="contained" onClick={handleImport} disabled={importing || !importId} sx={{ flex: "1 1 auto" }}>
                {importing ? <CircularProgress size={24} /> : t("create.import.fetchData")}
              </Button>
            </ActionRow>
            {importPlatform === "modrinth" && !hasModrinthKey && (
              <Alert severity="warning" sx={{ mt: 2 }} action={integrationSettingsLink}>
                {t("create.import.modrinthKeyWarning")}
              </Alert>
            )}
            {importPlatform === "curseforge" && !hasCurseForgeKey && (
              <Alert severity="warning" sx={{ mt: 2 }} action={integrationSettingsLink}>
                {t("create.import.curseforgeKeyWarning")}
              </Alert>
            )}
            {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
            {importData && !jarData && <Alert severity="success" sx={{ mt: 2 }}>{t("create.import.fetchSuccess")}</Alert>}
            <Alert severity="info" sx={{ mt: 2 }}>
              {t.rich("create.import.batchImportNotice", {
                link: (chunks) => (
                  <MuiLink component={Link} href="/projects/import" color="inherit" sx={{ fontWeight: "bold" }}>
                    {chunks}
                  </MuiLink>
                )
              })}
            </Alert>
          </CardContent>
        </Card>
      )}

      {tabIndex === 2 && (
        <Card sx={{ mb: 4, bgcolor: "background.default" }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>{t("create.jar.title")}</Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
              <Button component="label" variant="contained" disabled={jarImporting}>
                {jarImporting ? <CircularProgress size={24} color="inherit" /> : t("create.jar.select")}
                <input
                  type="file"
                  hidden
                  accept=".jar,.zip"
                  onChange={handleJarSelect}
                />
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("create.jar.hint")}
            </Typography>
            {jarError && <Alert severity="error" sx={{ mt: 2 }}>{jarError}</Alert>}
            {jarData && <Alert severity="success" sx={{ mt: 2 }}>{t("create.jar.fetchSuccess")}</Alert>}
          </CardContent>
        </Card>
      )}

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3, p: "2px" }}>
        {ideaId && <input type="hidden" name="ideaId" value={ideaId} />}
        {importData?.modrinthId && <input type="hidden" name="modrinthId" value={importData.modrinthId} />}
        {importData?.curseforgeId && <input type="hidden" name="curseforgeId" value={importData.curseforgeId} />}
        {importData?.externalDownloads !== undefined && <input type="hidden" name="externalDownloads" value={importData.externalDownloads} />}
        {importData?.issueTrackerUrl && <input type="hidden" name="issueTrackerUrl" value={importData.issueTrackerUrl} />}

        {/* どのフィールドにも紐付かないエラー（作成API自体の失敗）はフォーム先頭に出す */}
        {error?._form && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error._form[0]}
          </Alert>
        )}

        <ProjectFormFields key={formKey} error={error} project={importData || undefined} availableTags={availableTags} defaultLicense={defaultLicense} defaultBodyFormat={defaultBodyFormat} />

        <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <SettingsLink href="/settings/posting" label={tSettings("posting.title")} color="inherit" sx={{ color: "text.secondary" }} />
          <Box sx={{ display: "flex", gap: 2, ml: "auto" }}>
            <Button variant="outlined" onClick={() => router.back()} disabled={pending}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? t("create.creating") : t("create.submit")}
            </Button>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default NewProjectForm;
