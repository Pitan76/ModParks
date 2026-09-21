/**
 * "use server" のファイルから export されている関数のうち、認可の確認が見当たらないものを列挙する。
 *
 * Server Action は export した時点で外部から任意の引数で呼べる公開エンドポイントになる。
 * 2026-09 に、認可の無い export から他人の非公開コレクションやバックアップの中身を
 * 読めてしまう問題が見つかったため、同じ穴が無いかを機械的に確かめる目的で置いている。
 *
 * 判定は「関数本体の中（同じファイル内のローカル関数も 1 段たどる）に認可の呼び出しがあるか」。
 * 認可の無い export が必ずしも誤りとは限らない（公開情報を返すものもある）ので、
 * 出力は人が見て判断する前提の候補一覧。
 *
 * 使い方: node scripts/audit-server-actions.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const GUARD = /getAdminDb|getReauthenticatedAdminDb|getAuthenticatedDb|\bauth\(\)|assertProjectAccess|canEditProject|requireAdmin|assertAdmin|checkCronAuth|isAdminSession/;

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (p.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

function isUseServer(sf) {
  const first = sf.statements[0];
  return first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
}

/** export された関数（function 宣言と const = async () => {}）を名前と本体で集める */
function collectFunctions(sf) {
  const all = new Map();
  const exported = [];
  for (const st of sf.statements) {
    const isExport = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      all.set(st.name.text, st.body);
      if (isExport) exported.push(st.name.text);
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        const init = d.initializer;
        if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          all.set(d.name.text, init.body);
          if (isExport) exported.push(d.name.text);
        }
      }
    }
  }
  return { all, exported };
}

/** 本体の文字列と、そこから呼んでいる同じファイル内の関数の本体（1 段だけ）をつなぐ */
function reachableText(sf, all, name) {
  const body = all.get(name).getText(sf);
  let text = body;
  for (const [other, otherBody] of all) {
    if (other !== name && new RegExp(`\\b${other}\\(`).test(body)) text += otherBody.getText(sf);
  }
  return text;
}

const rows = [];
for (const file of walk("src")) {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  if (!isUseServer(sf)) continue;

  const { all, exported } = collectFunctions(sf);
  for (const name of exported) {
    if (!GUARD.test(reachableText(sf, all, name))) rows.push([file.replaceAll("\\", "/"), name]);
  }
}

for (const [file, name] of rows) console.log(`${file.replace("src/lib/actions/", "").padEnd(40)} ${name}`);
console.log(`\n件数: ${rows.length}`);
