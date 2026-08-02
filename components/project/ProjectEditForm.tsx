"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateProject } from "@/lib/actions/project";
import { syncExternalProjectData } from "@/lib/actions/projectSync";
import ActionRow from "@/components/ui/ActionRow";
import StickySaveBar from "@/components/ui/StickySaveBar";
import ProjectFormFields from "@/components/project/ProjectFormFields";
import SyncIcon from "@mui/icons-material/Sync";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";

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
  };
  availableTags?: { slug: string; name: string }[];
}

export default function ProjectEditForm({ project, availableTags = [] }: ProjectEditFormProps) {
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const t = useTranslations("Project");
  const tManage = useTranslations("Project.managePage");
  
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
    } catch (e: any) {
      if (e.message?.includes("Failed to find Server Action") || e.message?.includes("UnrecognizedActionError")) {
        setToast({ message: "新しいバージョンが反映されました。ページを更新しています...", severity: "info" });
        setTimeout(() => window.location.reload(), 1500);
      } else if (e.message?.includes("CF_API_KEY_MISSING")) {
        setToast({ message: tManage("apiKeyMissing"), severity: "error" });
      } else if (e.message?.includes("CF_SLUG_NOT_FOUND")) {
        setToast({ message: "CurseForgeで指定されたSlugが見つかりませんでした。正しいか確認してください。", severity: "error" });
      } else {
        setToast({ message: tManage("syncError"), severity: "error" });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    
    const maxRetries = 3;
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        // Server Action呼び出し
        const result = await updateProject(project.id, formData);
        
        if (result && result.error) {
          setError(result.error as { [key: string]: string[] });
          setPending(false);
          return; // バリデーションエラー時はリトライ不要
        } else {
          setDirty(false);
          success = true;
          setPending(false);
          setToast({ message: tCommon("saved"), severity: "success" });

          // 保存後も管理画面に留まる。slug を変更した場合だけ、
          // 現在の URL (/projects/[slug]/edit) が古くなるので置き換える
          const nextSlug = String(formData.get("slug") ?? project.slug);
          if (nextSlug !== project.slug) {
            router.replace(`/projects/${nextSlug}/edit`);
          } else {
            router.refresh();
          }
        }
      } catch (err: any) {
        retries++;
        console.error(`Save attempt ${retries} failed:`, err);
        
        if (err?.message?.includes("Failed to find Server Action") || err?.message?.includes("UnrecognizedActionError")) {
          setToast({ message: "新しいバージョンが反映されました。ページを更新しています...", severity: "info" });
          setPending(false);
          setTimeout(() => window.location.reload(), 1500);
          return;
        }

        if (retries >= maxRetries) {
          setToast({ message: `通信エラーが発生しました（${maxRetries}回再試行失敗）。少し時間を置いてからやり直してください。`, severity: "error" });
          setPending(false);
        } else {
          // リトライ前に待機 (1回目: 1秒, 2回目: 2秒...)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
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
              project.title / project.body から詰め替えて渡す */}
          <ProjectFormFields error={error} project={{ ...project, name: project.title, description: project.body } as any} availableTags={availableTags}>
            <FormControl fullWidth required>
              <InputLabel id="project-status-label">{t("fields.status")}</InputLabel>
              <Select
                labelId="project-status-label"
                id="project-status"
                name="status"
                label={t("fields.status")}
                defaultValue={project.visibility}
              >
                <MenuItem value="public">{tCommon("visibility.public")}</MenuItem>
                <MenuItem value="unlisted">{tCommon("visibility.unlisted")}</MenuItem>
                <MenuItem value="private">{tCommon("visibility.private")}</MenuItem>
                <MenuItem value="draft">{tCommon("visibility.draft")}</MenuItem>
              </Select>
            </FormControl>
          </ProjectFormFields>

          <FormControlLabel
            control={<Switch name="commentsEnabled" defaultChecked={!!project.commentsEnabled} />}
            label={t("fields.commentsEnabled")}
          />
          <FormControlLabel
            control={<Switch name="recipesEnabled" defaultChecked={!!project.recipesEnabled} />}
            label={t("fields.recipesEnabled")}
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
