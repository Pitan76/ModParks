"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useTranslations } from "next-intl";

interface CommentFormProps {
  title?: string;
  placeholder?: string;
  submitLabel: string;
  cancelLabel?: string;
  initialContent?: string;
  initialFormat?: string;
  onSubmit: (content: string, format: string) => Promise<boolean | void>;
  onCancel?: () => void;
  size?: "small" | "medium";
  minRows?: number;
}

export default function CommentForm({
  title,
  placeholder,
  submitLabel,
  cancelLabel,
  initialContent = "",
  initialFormat = "markdown",
  onSubmit,
  onCancel,
  size = "medium",
  minRows = 3,
}: CommentFormProps) {
  const tCommon = useTranslations("Common");
  const resolvedCancelLabel = cancelLabel ?? tCommon("cancel");
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [contentFormat, setContentFormat] = useState(initialFormat);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || pending) return;

    setPending(true);
    try {
      const result = await onSubmit(content, contentFormat);
      if (result !== false) {
        setContent("");
      }
    } finally {
      setPending(false);
    }
  };

  const isSmall = size === "small";

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: isSmall ? 1 : 1 }}>
      <Box sx={{ display: "flex", justifyContent: title ? "space-between" : "flex-end", alignItems: "center", mb: 0, flexWrap: "wrap", gap: 2 }}>
        {title && (
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
        )}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{tCommon("format")}</InputLabel>
          <Select
            value={contentFormat}
            label={tCommon("format")}
            onChange={(e) => setContentFormat(e.target.value)}
            disabled={pending}
          >
            <MenuItem value="markdown">{tCommon("formatOptions.markdown")}</MenuItem>
            <MenuItem value="plaintext">{tCommon("formatOptions.plaintext")}</MenuItem>
            <MenuItem value="pukiwiki">{tCommon("formatOptions.pukiwiki")}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TextField
        fullWidth
        multiline
        minRows={minRows}
        size={size}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={pending}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        {onCancel && (
          <Button 
            size={size}
            onClick={onCancel}
            disabled={pending}
          >
            {resolvedCancelLabel}
          </Button>
        )}
        <Button 
          type="submit" 
          variant="contained" 
          size={size}
          disabled={pending || !content.trim()}
        >
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}
