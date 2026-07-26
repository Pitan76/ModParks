import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const DB = "modparks-db";
const DUMP = "remote_data.sql";
const STATE_DIR = ".wrangler/state/v3/d1";

// ローカル開発で不要な監査/レート制限/一時系テーブルは同期対象から外し、
// リモートからの export 時間を短縮する。行(データ)のみ除外でスキーマは残る。
const EXCLUDE = new Set([
  "rate_limits",
  "backup_audit",
  "moderation_audit",
  "settings_audit",
  "deleted_records",
  "password_reset_tokens",
]);

/** wrangler d1 execute の --json 出力からログ行を除いて JSON を取り出す */
function queryLocal(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, "--local", "--json", `--command=${sql}`],
    { encoding: "utf8" }
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

function localTables() {
  const sql =
    "SELECT name FROM sqlite_master WHERE type='table' " +
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' " +
    "AND name NOT LIKE '\\_\\_new\\_%' ESCAPE '\\' AND name!='d1_migrations'";
  return queryLocal(sql).map((r) => r.name);
}

function run(args) {
  execFileSync("npx", ["wrangler", ...args], { stdio: "inherit" });
}

function main() {
  rmSync(STATE_DIR, { recursive: true, force: true });

  process.env.CI = "true";
  run(["d1", "migrations", "apply", DB, "--local"]);
  run(["d1", "execute", DB, "--local", "--command=DELETE FROM d1_migrations", "-y"]);

  const tables = localTables().filter((t) => !EXCLUDE.has(t));
  const tableArgs = tables.flatMap((t) => ["--table", t]);
  run(["d1", "export", DB, "--remote", `--output=${DUMP}`, "--no-schema", ...tableArgs, "-y"]);
  run(["d1", "execute", DB, "--local", `--file=${DUMP}`, "-y"]);

  rmSync(DUMP, { force: true });
  console.log(`\n同期完了: ${tables.length} テーブル (除外 ${EXCLUDE.size})`);
}

main();
