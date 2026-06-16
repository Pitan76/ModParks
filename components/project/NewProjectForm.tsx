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

export default function NewProjectForm({ availableTags, defaultLicense }: { availableTags: any[], defaultLicense?: string }) {
  const router = useRouter();
  const t = useTranslations("Project");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

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
      const result = await res.json();
      
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

      <Card>
        <CardContent sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <ProjectFormFields error={error} availableTags={availableTags} defaultLicense={defaultLicense} />

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
