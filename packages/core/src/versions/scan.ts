import { eq } from "drizzle-orm";
import { versions, projects, posts } from "@modparks/core/db/schema";
import { r2KeyFromUrl } from "@modparks/core/r2";
import type { JarClient } from "@modparks/core/jar/client";
import type { JarSource } from "@modparks/core/jar/types";
import { notifyToUser, type UserNotifyContext } from "@modparks/core/notifications/dispatch";
import { scanStatusLabel } from "@modparks/core/notifications/scanLabels";
import { applyScanMalicious } from "@modparks/core/services/trustModeration";

/**
 * バージョンファイル検査に要る環境依存の部品。
 * core は束縛や秘密値を自分で取りに行かないため、呼び出し側（Next / modparks-api）が揃えて渡す。
 */
export type VersionScanContext = {
  notify: UserNotifyContext;
  jar: JarClient;
  /** R2 の公開 URL。R2 上のファイルをキー指定で読ませるために使う */
  r2PublicUrl: string | undefined;
  /** 解析機能が有効か。検査対象外のファイルでは設定を読まずに済むよう関数で受ける */
  isAnalysisEnabled: () => Promise<boolean>;
  /** 確定検知時の管理者通知先（秘密値 DISCORD_WEBHOOK_URL） */
  adminWebhookUrl: string | undefined;
};

/** スキャン対象とする拡張子。zip 系以外は解凍できないため対象外 */
const SCANNABLE_EXTS = [".jar", ".zip"];

const isScannable = (fileName: string) =>
  SCANNABLE_EXTS.some((ext) => fileName.toLowerCase().endsWith(ext));

/** R2 上のファイルはキー指定、それ以外は URL を Worker に取得させる */
function toJarSource(r2PublicUrl: string | undefined, fileUrl: string): JarSource {
  const r2Key = r2KeyFromUrl(r2PublicUrl, fileUrl);
  if (r2Key) return { kind: "r2", key: r2Key };
  return { kind: "url", url: fileUrl };
}

/**
 * バージョンのファイルを jar Worker で検査し、結果を versions に記録する。
 *
 * 検査自体が失敗しても公開を止めないため、状態は skipped として先へ進める。
 * 応答後に走らせることを想定しており、呼び出し元へ例外は投げない。
 */
export async function scanVersionFile(ctx: VersionScanContext, versionId: string, fileUrl: string, fileName: string) {
  const { db } = ctx.notify;
  // 解析を止めている間もアップロード自体は通す。後から手動で再実行できる
  if (!isScannable(fileName) || !await ctx.isAnalysisEnabled()) {
    await db.update(versions)
      .set({ scanStatus: "skipped", scanAt: new Date() })
      .where(eq(versions.id, versionId))
      .run();
    return;
  }

  try {
    const result = await ctx.jar.scanJar(toJarSource(ctx.r2PublicUrl, fileUrl));
    await db.update(versions)
      .set({
        scanStatus: result.level,
        scanFindings: JSON.stringify(result.findings),
        scanAt: new Date(),
      })
      .where(eq(versions.id, versionId))
      .run();

    if (result.level === "malicious") {
      await applyScanMalicious(db, versionId, `scan: ${fileName}`, ctx.adminWebhookUrl);
    }

    if (result.level === "suspicious" || result.level === "malicious") {
      await notifyScanIssue(ctx.notify, versionId, result.level);
    }
  } catch (e) {
    console.error(`jar scan failed for version ${versionId}:`, e);
    const errorMsg = e instanceof Error ? e.message : String(e);
    await db.update(versions)
      .set({
        scanStatus: "failed",
        scanFindings: JSON.stringify([{ rule: "scan_error", target: errorMsg }]),
        scanAt: new Date(),
      })
      .where(eq(versions.id, versionId))
      .run();

    await notifyScanIssue(ctx.notify, versionId, "failed");
  }
}

async function notifyScanIssue(
  notify: UserNotifyContext,
  versionId: string,
  status: "suspicious" | "malicious" | "failed"
) {
  try {
    const project = await notify.db
      .select({
        authorId: posts.authorId,
        projectName: posts.title,
        projectSlug: posts.slug,
        iconUrl: projects.iconUrl,
        versionNumber: versions.versionNumber,
      })
      .from(versions)
      .innerJoin(projects, eq(versions.projectId, projects.id))
      .innerJoin(posts, eq(posts.id, projects.id))
      .where(eq(versions.id, versionId))
      .get();

    if (project) {
      await notifyToUser(notify, project.authorId, "system", "scan_result", {
        projectName: project.projectName,
        slug: project.projectSlug,
        versionNumber: project.versionNumber,
        versionId: versionId,
        statusLabel: scanStatusLabel(status),
        iconUrl: project.iconUrl || "",
      });
    }
  } catch (err) {
    console.error("Failed to send scan result notification:", err);
  }
}
