"use client";

import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import { useState } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { useRouter } from "next/navigation";

interface ProfileFormProps {
  initialData: {
    displayName: string;
    bio: string;
    avatarUrl: string;
  };
  labels: {
    displayName: string;
    bio: string;
  };
}

export default function ProfileForm({ initialData, labels }: ProfileFormProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "プロフィールを更新しました" });
      router.refresh();
    }
    setPending(false);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {message && <Alert severity={message.type}>{message.text}</Alert>}
      <TextField
        id="profile-display-name"
        name="displayName"
        label={labels.displayName}
        defaultValue={initialData.displayName}
        fullWidth
        required
        slotProps={{ htmlInput: { maxLength: 64 } }}
      />
      <TextField
        id="profile-avatar-url"
        name="avatarUrl"
        label="アイコン画像 URL"
        defaultValue={initialData.avatarUrl}
        fullWidth
        helperText="公開されている画像URLを入力してください"
      />
      <TextField
        id="profile-bio"
        name="bio"
        label={labels.bio}
        defaultValue={initialData.bio}
        multiline
        rows={3}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 500 } }}
        helperText="500文字以内"
      />
      <Button
        id="profile-save-btn"
        type="submit"
        variant="contained"
        size="large"
        disabled={pending}
      >
        {pending ? "保存中..." : "保存"}
      </Button>
    </Box>
  );
}
