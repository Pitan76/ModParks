"use client";

import { useRef, useState, useTransition } from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import { useTranslations } from "next-intl";
import StickySaveBar from "@/components/ui/StickySaveBar";
import ProjectDescriptionFields from "@/components/project/ProjectDescriptionFields";
import TranslationEditor from "@/components/project/TranslationEditor";
import { updateProjectDescription } from "@/lib/actions/project";

interface ProjectDescriptionFormProps {
  project: {
    id: string;
    body: string;
    bodyFormat?: string;
    sourceLocale?: string;
    aiTranslationEnabled?: boolean;
  };
}

/**
 * 説明タブ。原文の説明と、その訳文をまとめて扱う。
 *
 * 基本情報とはフォームを分けている（タブを入れ子にせず、送信対象も分けるため）。
 * 訳文は言語ごとに別の Server Action で保存するので、このフォームの外側に置く。
 */
export default function ProjectDescriptionForm({ project }: ProjectDescriptionFormProps) {
  const tCommon = useTranslations("Common");
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateProjectDescription(project.id, formData);
      const failed = "error" in result;
      setMessage({ text: failed ? tCommon("errorOccurred") : tCommon("saved"), failed });
      if (!failed) setDirty(false);
    });
  };

  return (
    <>
      <Box
        component="form"
        ref={formRef}
        onSubmit={handleSubmit}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        sx={{ display: "flex", flexDirection: "column", gap: 3, p: "2px" }}
      >
        <ProjectDescriptionFields
          description={project.body}
          descriptionFormat={project.bodyFormat}
          sourceLocale={project.sourceLocale}
          aiTranslationEnabled={project.aiTranslationEnabled ?? true}
          withSourceLocale
          onChange={() => setDirty(true)}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <TranslationEditor projectId={project.id} />
      </Box>

      <StickySaveBar
        open={dirty}
        saving={isPending}
        onSave={() => formRef.current?.requestSubmit()}
        onDiscard={() => setDirty(false)}
      />

      <Snackbar open={!!message} autoHideDuration={6000} onClose={() => setMessage(null)}>
        <Alert
          onClose={() => setMessage(null)}
          severity={message?.failed ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {message?.text}
        </Alert>
      </Snackbar>
    </>
  );
}
