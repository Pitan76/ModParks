"use server";

import { versions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getR2KeyFromUrl } from "@/lib/r2";
import { scanJar, type JarSource } from "@/lib/services/jar";

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
export async function scanVersionFile(db: any, versionId: string, fileUrl: string, fileName: string) {
  if (!isScannable(fileName)) {
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
  } catch (e) {
    console.error(`jar scan failed for version ${versionId}:`, e);
    await db.update(versions)
      .set({ scanStatus: "skipped", scanAt: new Date() })
      .where(eq(versions.id, versionId))
      .run();
  }
}
