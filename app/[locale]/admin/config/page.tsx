import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminConfigPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tAdmin = await getTranslations("Admin.config");

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: "bold" }}>
        {tAdmin("title")}
      </Typography>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{tAdmin("general")}</Typography>
          <Box component="form" sx={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: 600 }}>
            <TextField label={tAdmin("siteName")} defaultValue="ModParks" size="small" />
            <TextField label={tAdmin("siteDesc")} defaultValue="Minecraft Mod & Plugin Platform" size="small" multiline rows={3} />
            <Button variant="contained" sx={{ alignSelf: "flex-start" }}>{tAdmin("saveBtn")}</Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>{tAdmin("tagsManagement")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {tAdmin("tagsDesc")}
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
            <TextField label={tAdmin("newTag")} size="small" />
            <Button variant="outlined">{tAdmin("addTag")}</Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            {tAdmin("tagsPlaceholder")}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
