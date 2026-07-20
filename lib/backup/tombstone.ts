/**
 * 削除の墓標 (tombstone) 記録。
 *
 * マージ復元で「バックアップ後に削除された行」が復活するのを防ぐための記録です。
 * 削除処理の直後にこれを呼び、どの行が消されたかを残します。
 *
 * 行そのものは物理削除のままなので、通常の読み取りクエリには一切影響しません。
 */
import { deletedRecords } from "@/db/schema";

/**
 * 複合主キーを墓標用の単一文字列に変換します。
 * 列の順序で意味が変わるため、呼び出し側は常に同じ順序で渡してください。
 */
export function buildRecordKey(...parts: (string | number)[]): string {
  return parts.map(String).join(":");
}

/**
 * 削除された行を墓標として記録します。
 *
 * 記録の失敗が削除処理そのものを巻き添えにしないよう、エラーは握り潰します。
 * 墓標が欠けた場合の影響はマージ時にその行が復活しうることに留まり、
 * 削除操作自体を失敗させるより軽微だからです。
 */
export async function recordDeletion(
  db: any,
  tableName: string,
  recordKeys: string | string[]
) {
  const keys = Array.isArray(recordKeys) ? recordKeys : [recordKeys];
  if (keys.length === 0) return;

  try {
    await db
      .insert(deletedRecords)
      .values(keys.map((recordKey) => ({ tableName, recordKey, deletedAt: new Date() })))
      // 同じ行が再作成されてまた削除された場合に備え、重複はスキップせず日時を更新する
      .onConflictDoUpdate({
        target: [deletedRecords.tableName, deletedRecords.recordKey],
        set: { deletedAt: new Date() },
      });
  } catch (e) {
    console.error(`[tombstone] Failed to record deletion for ${tableName}:`, e);
  }
}

/**
 * 指定テーブルについて、墓標に載っている主キーの集合を返します。
 * マージ時に「復活させてはいけない行」を判定するために使います。
 */
export async function getTombstonedKeys(db: any, tableName: string): Promise<Set<string>> {
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ recordKey: deletedRecords.recordKey })
    .from(deletedRecords)
    .where(eq(deletedRecords.tableName, tableName))
    .all();

  return new Set(rows.map((r: { recordKey: string }) => r.recordKey));
}
