"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import { createIdeaComment } from "@/lib/actions/idea";
import { useTranslations } from "next-intl";

export default function IdeaCommentForm({ ideaId }: { ideaId: string }) {
  const tIdea = useTranslations("Idea");
  const tCommon = useTranslations("Common");
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
      alert(res.error.server?.[0] || tCommon("error"));
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
        minRows={2}
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={tIdea("addCommentPlaceholder")}
        disabled={pending}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.paper",
            borderRadius: 2,
          }
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={pending || !content.trim()}
          sx={{ borderRadius: 8, px: 3 }}
        >
          {tCommon("submit")}
        </Button>
      </Box>
    </Box>
  );
}
