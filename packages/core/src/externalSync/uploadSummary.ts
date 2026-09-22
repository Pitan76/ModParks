/**
 * 外部プラットフォームへの同時アップロード結果。
 *
 * クライアント側（アップロードフォーム）でも表示に使うため、DB や外部APIクライアントを
 * 一切 import しない純粋な型だけの置き場にしている。"use server" ファイル経由で
 * 型を再公開すると、サーバー専用モジュールがクライアントバンドルに引き込まれてしまう。
 */
export type ExternalUploadResult = { ok: true } | { ok: false; error: string };

export type ExternalUploadSummary = {
  modrinth?: ExternalUploadResult;
  curseforge?: ExternalUploadResult;
};
