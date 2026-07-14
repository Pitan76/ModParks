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

  const [jarImporting, setJarImporting] = useState(false);
  const [jarError, setJarError] = useState("");
  const [jarData, setJarData] = useState<any>(null);

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
    } catch (err: any) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleJarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJarImporting(true);
    setJarError("");
    setJarData(null);
    try {
      const JSZip = (await import('jszip')).default;
      const { parse } = await import('smol-toml');

      const zip = new JSZip();
      await zip.loadAsync(file);

      let foundData: any = null;

      // 1. Try fabric.mod.json
      if (zip.file("fabric.mod.json")) {
        const content = await zip.file("fabric.mod.json")!.async("string");
        const json = JSON.parse(content);
        foundData = {
          name: json.name || json.id,
          slug: json.id,
          description: json.description || "",
          license: typeof json.license === 'string' ? json.license : (json.license?.[0] || "MIT"),
          sourceUrl: json.contact?.sources || json.contact?.repo || "",
          issueTrackerUrl: json.contact?.issues || "",
        };
      }
      // 2. Try META-INF/mods.toml or META-INF/neoforge.mods.toml
      else if (zip.file("META-INF/mods.toml") || zip.file("META-INF/neoforge.mods.toml")) {
        const fileObj = zip.file("META-INF/mods.toml") || zip.file("META-INF/neoforge.mods.toml");
        const content = await fileObj!.async("string");
        const toml = parse(content) as any;
        const mod = toml.mods?.[0];
        if (mod) {
          foundData = {
            name: mod.displayName || mod.modId,
            slug: mod.modId,
            description: mod.description || "",
            license: mod.license || "All Rights Reserved",
            issueTrackerUrl: mod.issueTrackerURL || "",
          };
        }
      }
      // 3. Try mcmod.info
      else if (zip.file("mcmod.info")) {
        const content = await zip.file("mcmod.info")!.async("string");
        try {
          let json = JSON.parse(content);
          if (json.modList) json = json.modList;
          const mod = Array.isArray(json) ? json[0] : json;
          if (mod) {
            foundData = {
              name: mod.name || mod.modid,
              slug: mod.modid,
              description: mod.description || "",
              sourceUrl: mod.url || "",
            };
          }
        } catch (e) {
          console.warn("Invalid mcmod.info JSON", e);
        }
      }

      if (foundData) {
        if (foundData.description) {
           foundData.description = foundData.description.replace(/^\s+|\s+$/g, '');
        }
        if (foundData.slug) {
           // slugize just in case it has invalid chars, although modids are usually clean
           foundData.slug = foundData.slug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        }

        setImportData(foundData);
        setJarData(foundData);
        setFormKey(k => k + 1);
      } else {
        throw new Error(t("create.jar.fetchError"));
      }
    } catch (err: any) {
      console.error(err);
      setJarError(err.message || t("create.jar.fetchError"));
    } finally {
      setJarImporting(false);
      // Reset input so the same file can be selected again
      e.target.value = "";
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
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
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
            </Box>
            {importPlatform === "modrinth" && !hasModrinthKey && (
              <Alert severity="warning" sx={{ mt: 2 }}>{t("create.import.modrinthKeyWarning")}</Alert>
            )}
            {importPlatform === "curseforge" && !hasCurseForgeKey && (
              <Alert severity="warning" sx={{ mt: 2 }}>{t("create.import.curseforgeKeyWarning")}</Alert>
            )}
            {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
            {importData && !jarData && <Alert severity="success" sx={{ mt: 2 }}>{t("create.import.fetchSuccess")}</Alert>}
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
              fabric.mod.json, META-INF/mods.toml, META-INF/neoforge.mods.toml, mcmod.info 等のファイルからプロジェクト情報を自動取得します。
            </Typography>
            {jarError && <Alert severity="error" sx={{ mt: 2 }}>{jarError}</Alert>}
            {jarData && <Alert severity="success" sx={{ mt: 2 }}>{t("create.jar.fetchSuccess")}</Alert>}
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
