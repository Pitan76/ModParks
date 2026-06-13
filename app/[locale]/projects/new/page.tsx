"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createProject } from "@/lib/actions/project";

export default function NewProjectPage() {
  const router = useRouter();
  const t = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // Server Action呼び出し
    const result = await createProject(formData);
    
    if (result && result.error) {
      setError(result.error as { [key: string]: string[] });
      setPending(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        {t("create.title")}
      </Typography>

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
              <TextField
                id="project-name"
                name="name"
                label={t("fields.name")}
                fullWidth
                required
                error={!!error?.name}
                helperText={error?.name?.[0]}
              />
              <TextField
                id="project-slug"
                name="slug"
                label={t("fields.slug")}
                fullWidth
                required
                error={!!error?.slug}
                helperText={error?.slug?.[0] || t("fields.slugRule")}
              />
            </Stack>

            <FormControl fullWidth required error={!!error?.type}>
              <InputLabel id="project-type-label">{t("fields.type")}</InputLabel>
              <Select
                labelId="project-type-label"
                id="project-type"
                name="type"
                label={t("fields.type")}
                defaultValue="mod"
              >
                <MenuItem value="mod">{t("type.mod")}</MenuItem>
                <MenuItem value="plugin">{t("type.plugin")}</MenuItem>
              </Select>
              {error?.type && <Typography color="error" variant="caption">{error.type[0]}</Typography>}
            </FormControl>

            <TextField
              id="project-description"
              name="description"
              label={t("fields.description")}
              multiline
              rows={5}
              fullWidth
              required
              error={!!error?.description}
              helperText={error?.description?.[0]}
            />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
              <TextField
                id="project-license"
                name="license"
                label={t("fields.license")}
                fullWidth
                required
                defaultValue="MIT"
                error={!!error?.license}
                helperText={error?.license?.[0]}
              />
              <TextField
                id="project-source"
                name="sourceUrl"
                label={t("fields.sourceUrl")}
                fullWidth
                error={!!error?.sourceUrl}
                helperText={error?.sourceUrl?.[0]}
              />
            </Stack>

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
