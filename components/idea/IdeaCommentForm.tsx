"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { createIdeaComment } from "@/lib/actions/idea";

export default function IdeaCommentForm({ ideaId }: { ideaId: string }) {
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPending(true);
    const formData = new FormData();
    formData.append("content", content);

    const res = await createIdeaComment(ideaId, formData);
    if (res?.error) {
      alert(res.error.server?.[0] || "エラーが発生しました");
    } else {
      setContent("");
    }
    setPending(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
      <TextField
        fullWidth
        multiline
        rows={2}
        placeholder="コメントを追加..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={pending}
        size="small"
      />
      <Button
        type="submit"
        variant="contained"
        disabled={pending || !content.trim()}
        sx={{ mt: 0.5, borderRadius: 8 }}
      >
        送信
      </Button>
    </Box>
  );
}
