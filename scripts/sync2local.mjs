import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync, renameSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

// npx をコマンド名で起動すると環境差が出る（Windows では PATHEXT が効かず ENOENT、
// .cmd を直接指定すると Node 20 以降は shell 必須で EINVAL）。
// wrangler の JS エントリを node で直接実行すれば、シェルもクォートも介さず確実。
const WRANGLER = path.join("node_modules", "wrangler", "bin", "wrangler.js");

const DB = "modparks-db";
const DUMP = "remote_data.sql";
const STATE_DIR = ".wrangler/state/v3/d1";
const MIGRATIONS_DIR = "drizzle";
const HOLD_DIR = ".wrangler/_sync2local_hold";

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
function query(sql, { remote = false } = {}) {
  const out = execFileSync(
    process.execPath,
    [
      WRANGLER,
      "d1",
      "execute",
      DB,
      remote ? "--remote" : "--local",
      "--json",
      `--command=${sql}`,
      ...(remote ? ["-y"] : []),
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

function localTables() {
  const sql =
    "SELECT name FROM sqlite_master WHERE type='table' " +
    "AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' " +
    "AND name NOT LIKE '\\_\\_new\\_%' ESCAPE '\\' " +
    "AND name NOT LIKE '\\_\\_bak\\_%' ESCAPE '\\' AND name!='d1_migrations'";
  return query(sql).map((r) => r.name);
}

/**
 * リモートで既に適用済みのマイグレーション名を取得する（読み取りのみ）。
 * リモートへの書き込みは一切行わない。
 */
function remoteAppliedMigrations() {
  try {
    return new Set(query("SELECT name FROM d1_migrations", { remote: true }).map((r) => r.name));
  } catch {
    // d1_migrations が無い（初回等）の場合は「何も適用されていない」とみなす
    return new Set();
  }
}

function allMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function run(args) {
  execFileSync(process.execPath, [WRANGLER, ...args], { stdio: "inherit" });
}

function applyMigrations() {
  run(["d1", "migrations", "apply", DB, "--local"]);
}

/**
 * リモートに存在しないマイグレーションを一時退避する。
 *
 * リモートのダンプは「リモートのスキーマ」で出力されるため、ローカルを先に
 * 最新スキーマにしてしまうと取り込めない（列やテーブルが食い違う）。
 * そこで一旦リモートと同じ地点までマイグレーションを進めてデータを入れ、
 * そのあと残りを適用して最新へ追いつかせる。
 * 結果としてこのスクリプトは、本番移行のリハーサルも兼ねる。
 *
 * @returns 退避したファイル名の配列
 */
function holdUnappliedMigrations(applied) {
  const pending = allMigrationFiles().filter((f) => !applied.has(f));
  if (pending.length === 0) return [];

  rmSync(HOLD_DIR, { recursive: true, force: true });
  mkdirSync(HOLD_DIR, { recursive: true });
  for (const f of pending) {
    renameSync(path.join(MIGRATIONS_DIR, f), path.join(HOLD_DIR, f));
  }
  return pending;
}

/** 退避したマイグレーションを drizzle/ へ戻す */
function releaseHeldMigrations(held) {
  for (const f of held) {
    const from = path.join(HOLD_DIR, f);
    if (existsSync(from)) renameSync(from, path.join(MIGRATIONS_DIR, f));
  }
  rmSync(HOLD_DIR, { recursive: true, force: true });
}

/** リモートで適用済みのマイグレーションを、ローカルの台帳にも記録する */
function markApplied(names) {
  if (names.length === 0) return;
  const values = names.map((n) => `('${n}')`).join(",");
  query(`INSERT OR IGNORE INTO d1_migrations (name) VALUES ${values}`);
}

function main() {
  process.env.CI = "true";

  const applied = remoteAppliedMigrations();
  const all = allMigrationFiles();
  const pending = all.filter((f) => !applied.has(f));

  console.log(`リモート適用済み: ${applied.size} / 全 ${all.length} 件`);
  if (pending.length > 0) {
    console.log(`未適用（取り込み後にローカルで適用）: ${pending.length} 件`);
    for (const f of pending) console.log(`  - ${f}`);
  }

  rmSync(STATE_DIR, { recursive: true, force: true });

  let held = [];
  try {
    // 1. リモートと同じ地点までスキーマを進める
    held = holdUnappliedMigrations(applied);
    applyMigrations();

    // 2. リモートのデータを取り込む（--remote は export の読み取りのみ）
    const tables = localTables().filter((t) => !EXCLUDE.has(t));
    const tableArgs = tables.flatMap((t) => ["--table", t]);
    run(["d1", "export", DB, "--remote", `--output=${DUMP}`, "--no-schema", ...tableArgs, "-y"]);
    run(["d1", "execute", DB, "--local", `--file=${DUMP}`, "-y"]);
    rmSync(DUMP, { force: true });

    console.log(`\nデータ取り込み完了: ${tables.length} テーブル (除外 ${EXCLUDE.size})`);
  } finally {
    // 失敗しても drizzle/ を必ず元に戻す
    releaseHeldMigrations(held);
  }

  // 3. 残りのマイグレーションを本番データに対して適用する（移行リハーサル）
  if (pending.length > 0) {
    console.log(`\n未適用マイグレーションを適用します (${pending.length} 件)`);
    markApplied(all.filter((f) => applied.has(f)));
    applyMigrations();
  }

  console.log("\n同期完了");
}

main();
