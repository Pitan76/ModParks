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

  /** 1 クエリを実行し、sqlite-proxy が期待する { rows } 形式に整える */
  const runOne = (sql: string, params: unknown[], method: string) => {
    const stmt = sqlite.prepare(sql);
    if (method === "run") {
      stmt.run(...params);
      return { rows: [] as unknown[] };
    }

    // sqlite-proxy は値の配列を期待するため、行を列順の配列へ変換する。
    //
    // ⚠ Object.values(row) を使ってはいけない。
    // node:sqlite は行をオブジェクトで返すため、SELECT に同名の列が複数あると
    // （例: posts.id と users.id を同時に取る join）キーが衝突して 1 つに潰れ、
    // 配列の要素数が SQL の列数より少なくなる。sqlite-proxy は値を位置で読むので、
    // 以降の列が 1 つずつずれて別カラムの値が入る。
    // 本番の D1 ドライバは値の配列を直接返すため、これはローカル開発時だけ起きる。
    stmt.setReturnArrays?.(true);
    const raw = stmt.all(...params) as unknown[];
    const rows = raw.map((row) =>
      Array.isArray(row) ? row : Object.values(row as Record<string, unknown>)
    );

    // method="get" で該当行が無いときは rows を渡さない。
    //
    // ⚠ ここで { rows: [] } を返してはいけない。
    // drizzle は空配列から「全カラム undefined のオブジェクト」を組み立ててしまい、
    // `if (row)` が常に true になる。その結果 findProjectPostBySlug などが
    // null を返せず、存在しない slug で 404 のはずが 500 になる。
    // rows を undefined にすると drizzle は正しく undefined を返す。
    if (method === "get") {
      return rows.length > 0
        ? { rows: rows[0] as unknown[] }
        : ({} as { rows: unknown[] });
    }
    return { rows };
  };

  return drizzle(
    async (sql, params, method) => runOne(sql, params, method),
    // 第2引数の batchCallback を渡さないと db.batch() が実行時例外になる。
    // Post 統合以降、posts と projects/ideas は必ず batch で同時に書くため、
    // これが無いとローカルでは投稿の作成・更新が一切できない。
    // 本番の D1 ドライバは batch を持つので、この問題もローカル限定。
    async (queries) => {
      // D1 の batch は全体が 1 トランザクション。node:sqlite でも挙動を揃える。
      sqlite.exec("BEGIN");
      try {
        const results = queries.map((q) => runOne(q.sql, q.params, q.method));
        sqlite.exec("COMMIT");
        return results;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
    { schema }
  );
};
