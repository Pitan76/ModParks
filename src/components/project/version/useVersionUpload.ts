"use client";

import { useState, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "@/lib/i18n/routing";
import { useTranslations } from "next-intl";
import { createVersion } from "@/lib/actions/version";
import { parseModJar } from "@/lib/utils/modParser";
import { uploadFileToR2 } from "@/lib/utils/upload";
import { DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import { runRecipeExtraction } from "./extractRecipes";
import type { DependencyDraft } from "@/lib/dependencies/types";
import type { PreviousVersionSettings } from "../PreviousVersionSettings";

const MB_LIMIT = 5;
const FILE_SIZE_LIMIT = MB_LIMIT * 1024 * 1024;

export type UploadMode = "file" | "url";
export type FieldErrors = { [key: string]: string[] } | null;

/**
 * 新バージョン登録フォームの状態と送信手順。
 * 表示（VersionUploadForm）から手順を切り離し、UI を差し替えても流れが変わらないようにする。
 */
export function useVersionUpload(slug: string, previousSettings: PreviousVersionSettings | null) {
  const router = useRouter();
  const tVersion = useTranslations("Version");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FieldErrors>(null);
  const [mcVersions, setMcVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [releaseChannel, setReleaseChannel] = useState<string>(DEFAULT_RELEASE_CHANNEL);
  const [extractRecipes, setExtractRecipes] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reuseApplied, setReuseApplied] = useState(false);
  const [dependencies, setDependencies] = useState<DependencyDraft[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const failWithFileError = (messageKey: string) => {
    setError({ fileUrl: [tVersion(messageKey)] });
  };

  /** JAR 解析結果を上書きしないよう、流用はユーザーの明示操作に限る */
  const handleReusePrevious = () => {
    if (!previousSettings) return;
    setMcVersions(previousSettings.mcVersions);
    setLoaders(previousSettings.loaders);
    setReleaseChannel(previousSettings.releaseChannel);
    setReuseApplied(true);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (!selectedFile) return;

    setParsing(true);
    try {
      const { detectedVersion, detectedLoaders, detectedMcVersions } = await parseModJar(selectedFile);
      if (detectedVersion) setVersionNumber(detectedVersion);
      if (detectedLoaders.length > 0) setLoaders(detectedLoaders);
      if (detectedMcVersions.length > 0) {
        setMcVersions((prev) => Array.from(new Set([...prev, ...detectedMcVersions])));
      }
    } catch (err) {
      console.error("Failed to read JAR/ZIP", err);
    } finally {
      setParsing(false);
    }
  };

  /** アップロード方式に応じてファイル情報を formData へ載せる */
  const attachFile = async (formData: FormData): Promise<boolean> => {
    if (uploadMode !== "file" || !file) {
      formData.append("fileUrl", externalUrl);
      formData.append("fileName", externalUrl.split("/").pop() || "external-file");
      return true;
    }

    if (file.size > FILE_SIZE_LIMIT) {
      failWithFileError("uploadForm.error.fileTooLarge");
      return false;
    }

    const { publicUrl } = await uploadFileToR2(file, { type: "mod", projectSlug: slug }, {
      uploadError: tVersion("uploadForm.error.uploadFailed"),
    });
    formData.append("fileUrl", publicUrl);
    formData.append("fileName", file.name);
    formData.append("fileSize", file.size.toString());
    return true;
  };

  /**
   * 1. R2 へアップロード → 2. バージョン登録 → 3. 任意でレシピ抽出。
   * 抽出が失敗してもバージョンは作成済みなので、遷移せずこのページで理由を示す。
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const hasSource = uploadMode === "file" ? !!file : !!externalUrl;
    if (!hasSource) return failWithFileError("uploadForm.error.fileRequired");

    setPending(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      formData.delete("mcVersions");
      formData.delete("loaders");
      mcVersions.forEach((v) => formData.append("mcVersions", v));
      loaders.forEach((l) => formData.append("loaders", l));
      formData.set("releaseChannel", releaseChannel);
      // 依存関係はバージョンと同じ送信で渡す。作成後に別途保存すると、
      // 途中で失敗したときに依存の無いバージョンだけが残る
      if (dependencies.length > 0) {
        formData.set("dependencies", JSON.stringify(dependencies));
      }

      if (!(await attachFile(formData))) {
        setPending(false);
        return;
      }

      const result = await createVersion(slug, formData);
      if (result && result.error) {
        setError(result.error as { [key: string]: string[] });
        setPending(false);
        return;
      }

      const versionId = result && "versionId" in result ? result.versionId : null;
      // トグルはファイルアップロード時のみ表示されるため、抽出もその場合に限る
      if (extractRecipes && versionId && uploadMode === "file" && file) {
        setExtracting(true);
        const extraction = await runRecipeExtraction(versionId, slug, file);
        setExtracting(false);

        if (!extraction.ok) {
          setError({
            fileUrl: [tVersion("uploadForm.error.extractFailed", { message: extraction.message })],
          });
          setPending(false);
          return;
        }
      }

      router.push(`/projects/${slug}`);
    } catch (err: unknown) {
      console.error(err);
      setError({ fileUrl: [err instanceof Error ? err.message : tVersion("uploadForm.error.uploadError")] });
    } finally {
      setPending(false);
    }
  };

  return {
    router,
    pending,
    error,
    setError,
    mcVersions,
    setMcVersions,
    loaders,
    setLoaders,
    uploadMode,
    setUploadMode,
    file,
    externalUrl,
    setExternalUrl,
    versionNumber,
    setVersionNumber,
    releaseChannel,
    setReleaseChannel,
    extractRecipes,
    setExtractRecipes,
    parsing,
    extracting,
    reuseApplied,
    dependencies,
    setDependencies,
    fileInputRef,
    handleReusePrevious,
    handleFileChange,
    handleSubmit,
  };
}
