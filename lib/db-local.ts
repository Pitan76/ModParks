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

      // sqlite-proxy は値の配列を期待するため、行オブジェクトを列順の配列へ変換する。
      //
      // ⚠ Object.values(row) を使ってはいけない。
      // node:sqlite は行をオブジェクトで返すため、SELECT に同名の列が複数あると
      // （例: posts.id と users.id を同時に取る join）キーが衝突して 1 つに潰れ、
      // 配列の要素数が SQL の列数より少なくなる。sqlite-proxy は位置で値を
      // 読むので、以降の列が 1 つずつずれて別のカラムの値が入る。
      // 本番の D1 ドライバは値の配列を直接返すためこの問題は起きず、
      // ローカル開発時だけ再現する。
      //
      // 対策として、列名ではなく列の位置で値を取り出す。
      stmt.setReturnArrays?.(true);
      const raw = stmt.all(...params) as unknown[];
      const rows = raw.map((row) =>
        Array.isArray(row) ? row : Object.values(row as Record<string, unknown>)
      );
      if (method === "get") return { rows: rows[0] ?? [] };
      return { rows };
    },
    { schema }
  );
};
