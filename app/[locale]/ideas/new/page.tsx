"use client";

import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createIdea } from "@/lib/actions/idea";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LinkButton from "@/components/ui/LinkButton";

export default function NewIdeaPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      <Box sx={{ mb: 3 }}>
        <LinkButton href="/ideas" variant="text" color="inherit" startIcon={<ArrowBackIcon />}>
          アイデア一覧に戻る
        </LinkButton>
      </Box>

      <Typography variant="h4" sx={{ fontWeight: 800, mb: 4 }}>
        アイデアを投稿
      </Typography>

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
                label="タイトル"
                name="title"
                required
                fullWidth
                error={!!error?.title}
                helperText={error?.title?.[0] || "例: 建築が楽になる魔法の杖を追加するMod"}
                disabled={pending}
                size="small"
              />

              <TextField
                label="どんなMod/Pluginが欲しいですか？"
                name="content"
                required
                fullWidth
                multiline
                rows={8}
                error={!!error?.content}
                helperText={error?.content?.[0] || "具体的な機能や、なぜ欲しいのかを書いてみましょう。"}
                disabled={pending}
              />

              <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={pending}
                  sx={{ px: 5, borderRadius: 8 }}
                >
                  {pending ? "送信中..." : "アイデアを投稿する"}
                </Button>
              </Box>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
