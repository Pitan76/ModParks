import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAdminDb } from "@/lib/auth-helpers";
import { tags, platforms } from "@/db/schema";
import { getAppSettings } from "@/lib/config/readSettings";
import { listWorkerVars } from "@/lib/actions/workerVars";
import { listSecrets } from "@/lib/actions/workerSecrets";
import ConfigClient from "./ConfigClient";
import ConfigTabs from "./ConfigTabs";
import AppSettingsPanel from "./AppSettingsPanel";
import WorkerVarsPanel from "./WorkerVarsPanel";
import SecretsPanel from "./SecretsPanel";

export default async function AdminConfigPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.config");

  const { db } = await getAdminDb();

  const [allTags, allPlatforms, appSettings, varsResult, secretsResult] = await Promise.all([
    db.select().from(tags).all(),
    db.select().from(platforms).all(),
    getAppSettings(),
    listWorkerVars(),
    listSecrets(),
  ]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>
      <ConfigTabs
        appSettings={<AppSettingsPanel initialSettings={appSettings} />}
        workerVars={
          <WorkerVarsPanel
            initialVars={"success" in varsResult ? varsResult.vars : []}
            loadError={"error" in varsResult ? varsResult.error : undefined}
          />
        }
        secrets={
          <SecretsPanel
            initialSecrets={"success" in secretsResult ? secretsResult.secrets : []}
            loadError={"error" in secretsResult ? secretsResult.error : undefined}
          />
        }
        taxonomy={<ConfigClient initialTags={allTags} initialPlatforms={allPlatforms} />}
      />
    </Box>
  );
}
