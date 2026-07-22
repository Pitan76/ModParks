import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";

/**
 * 開発環境で .wrangler 配下の miniflare SQLite ファイルを探索します。
 * @returns SQLiteファイルの絶対パス。見つからない場合は null
 */
const findLocalSqlitePath = async (): Promise<string | null> => {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const dir = path.join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!fs.existsSync(dir)) return null;

  const file = fs.readdirSync(dir).find((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  if (!file) return null;
  return path.join(dir, file);
};

/**
 * Wrangler Proxy の通信オーバーヘッドを避けるため、node:sqlite で
 * miniflare の SQLite ファイルを直接オープンした Drizzle インスタンスを生成します。
 * drizzle-orm には node:sqlite 用ドライバが存在しないため sqlite-proxy 経由で接続します。
 * @returns Drizzle インスタンス。ローカルDBが存在しない場合は null
 */
export const createLocalSqliteDb = async () => {
  const sqlitePath = await findLocalSqlitePath();
  if (!sqlitePath) return null;

  // @ts-expect-error - node:sqlite は Node 22+ で利用可能だが型定義が無い環境がある
  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(sqlitePath);
  console.log(`[D1 Local] Connected directly to SQLite: ${sqlitePath}`);

  return drizzle(
    async (sql, params, method) => {
      const stmt = sqlite.prepare(sql);
      if (method === "run") {
        stmt.run(...params);
        return { rows: [] };
      }

      // sqlite-proxy は値の配列を期待するため、行オブジェクトを列順の配列へ変換する
      const rows = stmt.all(...params).map((row: Record<string, unknown>) => Object.values(row));
      if (method === "get") return { rows: rows[0] ?? [] };
      return { rows };
    },
    { schema }
  );
};
