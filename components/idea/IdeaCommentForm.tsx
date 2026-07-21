"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { createIdeaComment } from "@/lib/actions/idea";
import { useTranslations } from "next-intl";

export default function IdeaCommentForm({ ideaId }: { ideaId: string }) {
  const tIdea = useTranslations("Idea");
  const tCommon = useTranslations("Common");
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState("markdown");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPending(true);
    const formData = new FormData();
    formData.append("content", content);
    formData.append("contentFormat", contentFormat);

    const res = await createIdeaComment(ideaId, formData);
    if (res?.error) {
      const errMsg = "server" in res.error ? res.error.server?.[0] : undefined;
      alert(errMsg || tCommon("error"));
    } else {
      setContent("");
    }
    setPending(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>形式</InputLabel>
          <Select
            value={contentFormat}
            label="形式"
            onChange={(e) => setContentFormat(e.target.value)}
            disabled={pending}
          >
            <MenuItem value="markdown">Markdown</MenuItem>
            <MenuItem value="plaintext">Plain Text</MenuItem>
            <MenuItem value="pukiwiki">PukiWiki</MenuItem>
          </Select>
        </FormControl>
      </Box>

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

      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button 
          type="submit" 
          variant="contained" 
          disabled={pending || !content.trim()}
          sx={{ borderRadius: 2, px: 3 }}
        >
          {tCommon("submit")}
        </Button>
      </Box>
    </Box>
  );
}
