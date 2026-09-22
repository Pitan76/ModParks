"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { useRef, useState } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { syncExternalProjectData } from "@/lib/http/projectApi";
import ActionRow from "@/components/ui/ActionRow";
import StickySaveBar from "@/components/ui/StickySaveBar";
import ProjectFormFields from "@/components/project/ProjectFormFields";
import SwitchField from "@/components/ui/SwitchField";
import SyncIcon from "@mui/icons-material/Sync";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

interface ProjectEditFormProps {
  project: {
    id: string;
    title: string;
    slug: string;
    type: string;
    body: string;
    license: string;
    sourceUrl?: string | null;
    visibility: string;
    commentsEnabled?: boolean;
    recipesEnabled?: boolean;
    aiGenerated?: boolean;
    bodyFormat?: string;
    sourceLocale?: string;
    aiTranslationEnabled?: boolean;
  };
  availableTags?: { slug: string; name: string }[];
}

type SaveResult =
  | { type: "saved" }
  | { type: "invalid"; fieldErrors: Record<string, string[]> }
  | { type: "denied" };

/**
 * 基本情報を保存する（modparks-api の PATCH /api/app/projects/:id）。
 *
 * 以前は Server Action の updateProject を呼んでいた。本体は core にあり同じものが動く。
 * 入力エラー（422）と権限の問題（401/403/404）は結果で返し、再試行で直りうる
 * 失敗（5xx・通信断）だけを例外にする。権限の問題は再試行しても変わらないため。
 */
async function saveProject(projectId: string, formData: FormData, locale: string): Promise<SaveResult> {
  // エラー文言をこのページの言語で返してもらう（API の URL には言語が無いため）
  const res = await fetch(`/api/app/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: formData,
    headers: { "X-MP-Locale": locale },
  });
  if (res.ok) return { type: "saved" };
  if (res.status === 422) return { type: "invalid", fieldErrors: ((await res.json()) as { error: Record<string, string[]> }).error };
  if (res.status === 401 || res.status === 403 || res.status === 404) return { type: "denied" };

  throw new Error(`save failed: ${res.status}`);
}

export default function ProjectEditForm({ project, availableTags = [] }: ProjectEditFormProps) {
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("Project");
  const tManage = useTranslations("Project.managePage");
  const tError = useTranslations("ServerErrors");
  
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: "success" | "error" | "info" } | null>(null);
  const [error, setError] = useState<{ [key: string]: string[] } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncExternalProjectData(project.id);
      setToast({ message: tManage("syncSuccess"), severity: "success" });
      // Server Action のときは暗黙に画面が取り直されていた。ダウンロード数の表示を更新するため
      router.refresh();
    } catch (e: any) {
      if (e.message?.includes("Failed to find Server Action") || e.message?.includes("UnrecognizedActionError")) {
        setToast({ message: tError("common.reloading"), severity: "info" });
        setTimeout(() => window.location.reload(), 1500);
      } else if (e.message?.includes("CF_API_KEY_MISSING")) {
        setToast({ message: tManage("apiKeyMissing"), severity: "error" });
      } else if (e.message?.includes("CF_SLUG_NOT_FOUND")) {
        setToast({ message: tError("project.cfSlugNotFound"), severity: "error" });
      } else {
        setToast({ message: tManage("syncError"), severity: "error" });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSaved = (formData: FormData) => {
    setDirty(false);
    setPending(false);
    setToast({ message: tCommon("saved"), severity: "success" });

    // 保存後も管理画面に留まる。slug を変更した場合だけ、
    // 現在の URL (/projects/[slug]/edit) が古くなるので置き換える
    const nextSlug = String(formData.get("slug") ?? project.slug);
    if (nextSlug !== project.slug) router.replace(`/projects/${nextSlug}/edit`);
    else router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await saveProject(project.id, formData, locale);
        setPending(false);
        if (result.type === "saved") return handleSaved(formData);
        if (result.type === "denied") return setToast({ message: tCommon("error"), severity: "error" });

        setError(result.fieldErrors);
        // 画面に出ていない項目のエラーだと、そのままでは無反応に見えてしまう
        setToast({ message: tError("common.validationFailed", { fields: Object.keys(result.fieldErrors).join(", ") }), severity: "error" });
        return;
      } catch (err) {
        console.error(`Save attempt ${attempt} failed:`, err);
        if (attempt === maxRetries) {
          setToast({ message: tError("common.networkRetryFailed", { count: maxRetries }), severity: "error" });
          setPending(false);
          return;
        }
        // リトライ前に待機 (1回目: 1秒, 2回目: 2秒...)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  };

  return (
    <>
      {/* フォームは非制御のため、入力・選択の発生だけを見て未保存状態を立てる */}
      <Box
        component="form"
        ref={formRef}
        onSubmit={handleSubmit}
        onInput={() => setDirty(true)}
        onChange={() => setDirty(true)}
        sx={{ display: "flex", flexDirection: "column", gap: 3, p: "2px" }}
      >
          {/* ProjectFormFields のフォームフィールド名（name/description）は
              Server Action (updateProject) の契約に合わせて変えていない。
              project.title / project.body から詰め替えて渡す。
              説明は別タブの ProjectDescriptionForm が持つのでここには出さない */}
          <ProjectFormFields
            error={error}
            project={{ ...project, name: project.title, description: project.body } as any}
            availableTags={availableTags}
            withDescription={false}
            onChange={() => setDirty(true)}
          >
            <FormControl fullWidth required>
              <InputLabel id="project-status-label">{t("fields.status")}</InputLabel>
              <Select
                labelId="project-status-label"
                id="project-status"
                name="status"
                label={t("fields.status")}
                defaultValue={project.visibility}
                onChange={() => setDirty(true)}
              >
                <MenuItem value="public">{tCommon("visibility.public")}</MenuItem>
                <MenuItem value="unlisted">{tCommon("visibility.unlisted")}</MenuItem>
                <MenuItem value="private">{tCommon("visibility.private")}</MenuItem>
                <MenuItem value="draft">{tCommon("visibility.draft")}</MenuItem>
              </Select>
            </FormControl>
          </ProjectFormFields>

          <SwitchField
            name="commentsEnabled"
            label={t("fields.commentsEnabled")}
            defaultChecked={!!project.commentsEnabled}
            onChange={() => setDirty(true)}
          />
          <SwitchField
            name="recipesEnabled"
            label={t("fields.recipesEnabled")}
            defaultChecked={!!project.recipesEnabled}
            onChange={() => setDirty(true)}
          />

          <ActionRow align="center" sx={{ mt: 2 }}>
            <Button
              variant="text"
              color="primary"
              startIcon={<SyncIcon />}
              onClick={handleSync}
              disabled={syncing || pending}
            >
              {syncing ? tManage("syncing") : tManage("sync")}
            </Button>
          </ActionRow>
      </Box>

      <StickySaveBar
        open={dirty}
        saving={pending}
        onSave={() => formRef.current?.requestSubmit()}
        onDiscard={() => router.back()}
      />

      <Snackbar open={!!toast} autoHideDuration={6000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ width: '100%' }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
