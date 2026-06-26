"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { createIdea } from "@/lib/actions/idea";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LinkButton from "@/components/ui/LinkButton";
import { useTranslations } from "next-intl";

export default function NewIdeaPage() {
  const router = useRouter();
  const tIdea = useTranslations("Idea");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    // Server Action呼び出し
    const result = await createIdea(formData);
    
    if (result && result.error) {
      setError(result.error as { [key: string]: string[] });
      setPending(false);
    } else if (result && result.success && result.id) {
      router.push(`/ideas/${result.id}`);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box sx={{ mb: 4 }}>
        <LinkButton startIcon={<ArrowBackIcon />} href="/ideas" sx={{ mb: 2 }}>
          {tIdea("backToList")}
        </LinkButton>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          {tIdea("postIdeaTitle")}
        </Typography>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={4}>
              {error?.server && (
                <Typography color="error" variant="body2">
                  {error.server[0]}
                </Typography>
              )}

              <TextField
                id="title"
                name="title"
                label={tIdea("fields.title")}
                fullWidth
                required
                error={!!error?.title}
                helperText={error?.title?.[0] || tIdea("fields.titlePlaceholder")}
                disabled={pending}
                size="small"
              />

              <TextField
                id="content"
                name="content"
                label={tIdea("fields.content")}
                fullWidth
                required
                multiline
                rows={6}
                error={!!error?.content}
                helperText={error?.content?.[0] || tIdea("fields.contentPlaceholder")}
                disabled={pending}
              />

              <FormControl fullWidth size="small">
                <InputLabel>{tIdea("fields.visibility")}</InputLabel>
                <Select
                  name="visibility"
                  label={tIdea("fields.visibility")}
                  defaultValue="public"
                  disabled={pending}
                >
                  <MenuItem value="public">{tIdea("fields.visibilityOptions.public")}</MenuItem>
                  <MenuItem value="unlisted">{tIdea("fields.visibilityOptions.unlisted")}</MenuItem>
                  <MenuItem value="private">{tIdea("fields.visibilityOptions.private")}</MenuItem>
                  <MenuItem value="draft">{tIdea("fields.visibilityOptions.draft")}</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={pending}
                  sx={{ px: 5 }}
                >
                  {pending ? tIdea("submitting") : tIdea("submitIdea")}
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
