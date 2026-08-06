import { useRef, useState } from "react";
import { resizeImageFile } from "@/lib/utils/image";
import { uploadFileToR2 } from "@/lib/utils/upload";

export interface UseAvatarUploadOptions {
  /** アップロード成功時に公開URLを受け取る */
  onUploaded: (url: string) => void;
  /** 失敗時のメッセージ通知 */
  onError: (message: string) => void;
  /** presign / PUT 失敗時のフォールバック文言（i18n 済みを呼び出し側から渡す） */
  errorMessages?: { presign?: string; upload?: string };
}

/**
 * アバター画像アップロードの共通フック。
 * リサイズ(400x400) → R2 アップロード → 状態管理を集約する。
 * 表示や通知手段（flash 等）は呼び出し側に委ねる。
 */
export function useAvatarUpload({ onUploaded, onError, errorMessages }: UseAvatarUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const resizedFile = await resizeImageFile(file, 400, 400);
      const { publicUrl } = await uploadFileToR2(resizedFile, { type: "avatar" }, {
        presignError: errorMessages?.presign,
        uploadError: errorMessages?.upload,
      });
      onUploaded(publicUrl);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return { uploading, fileInputRef, handleFileChange };
}
