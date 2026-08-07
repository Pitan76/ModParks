"use server";

import { versions, projects, posts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getR2KeyFromUrl } from "@/lib/r2";
import { scanJar, type JarSource } from "@/lib/services/jar";
import { checkFeatureEnabled } from "@/lib/runtime/guard";
import type { Database } from "@/lib/db";
import { scanStatusLabel } from "@/lib/notifications/scanLabels";

/** スキャン対象とする拡張子。zip 系以外は解凍できないため対象外 */
const SCANNABLE_EXTS = [".jar", ".zip"];

const isScannable = (fileName: string) =>
  SCANNABLE_EXTS.some((ext) => fileName.toLowerCase().endsWith(ext));

/** R2 上のファイルはキー指定、それ以外は URL を Worker に取得させる */
function toJarSource(fileUrl: string): JarSource {
  const r2Key = getR2KeyFromUrl(fileUrl);
  if (r2Key) return { kind: "r2", key: r2Key };
  return { kind: "url", url: fileUrl };
}

/**
 * バージョンのファイルを jar Worker で検査し、結果を versions に記録する。
 *
 * 検査自体が失敗しても公開を止めないため、状態は skipped として先へ進める。
 * `after()` から呼ぶことを想定しており、呼び出し元へ例外は投げない。
 */
export async function scanVersionFile(db: Database, versionId: string, fileUrl: string, fileName: string) {
  // 解析を止めている間もアップロード自体は通す。後から手動で再実行できる
  if (!isScannable(fileName) || !await checkFeatureEnabled("jarAnalysis")) {
    await db.update(versions)
      .set({ scanStatus: "skipped", scanAt: new Date() })
      .where(eq(versions.id, versionId))
      .run();
    return;
  }

  try {
    const result = await scanJar(toJarSource(fileUrl));
    await db.update(versions)
      .set({
        scanStatus: result.level,
        scanFindings: JSON.stringify(result.findings),
        scanAt: new Date(),
      })
      .where(eq(versions.id, versionId))
      .run();

    if (result.level === "malicious") {
      const { applyScanMalicious } = await import("@/lib/services/trustModeration");
      await applyScanMalicious(versionId, `scan: ${fileName}`);
    }

    if (result.level === "suspicious" || result.level === "malicious") {
      await notifyScanIssue(db, versionId, result.level);
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

    await notifyScanIssue(db, versionId, "failed");
  }
}

async function notifyScanIssue(
  db: Database,
  versionId: string,
  status: "suspicious" | "malicious" | "failed"
) {
  try {
    const project = await db
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
      const { notifyToUser } = await import("@/lib/notifications/notify");
      await notifyToUser(db, project.authorId, "system", "scan_result", {
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
