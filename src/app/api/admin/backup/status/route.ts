import { getEncryptionStatus } from "@/lib/actions/adminBackupQuery";

/**
 * バックアップの暗号化・Google Drive の設定状況（管理者のみ）。
 *
 * 管理画面のバックアップタブがマウント時に読む。以前は Server Action を直接
 * 呼んでおり、中の auth() がセッション Cookie を書き直すため、開くたびに画面の
 * 再取得が 1 回余計に走っていた。GET のルートハンドラならそれが起きない。
 *
 * modparks-api（Hono）へは移さない。見ているのが BACKUP_ENCRYPTION_KEY の有無で、
 * これは管理画面からも変更できないよう保護している鍵なので、別の Worker へ
 * 複製したくないため。
 */
export async function GET() {
  // 入口なので、認可の失敗（getAdminDb が投げる）をここで状態コードに変える
  try {
    return Response.json(await getEncryptionStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Unauthorized") return Response.json({ error: message }, { status: 401 });
    if (message === "Forbidden") return Response.json({ error: message }, { status: 403 });
    throw error;
  }
}
