/**
 * Minecraft バージョンの手動入力を、既知バージョンの配列へ展開するユーティリティ。
 *
 * minecraftVersions.ts と同様、UI や zod に依存しない純粋関数として保つこと。
 *
 * 対応する記法（`,` / 空白 区切りで複数指定可）:
 *   - `1.18`        → ["1.18"]
 *   - `1.18.*`      → ["1.18", "1.18.1", "1.18.2"]   (`1.18.x` も同じ)
 *   - `1.19-1.19.2` → ["1.19", "1.19.1", "1.19.2"]
 */

/** "1.18.2" → [1, 18, 2]。数値化できない要素があれば null（Beta 表記など）。 */
function parseVersion(version: string): number[] | null {
  const parts = version.split(".");
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    numbers.push(Number(part));
  }
  return numbers.length > 0 ? numbers : null;
}

/** semver 風の辞書順比較。短い方は 0 埋め扱い（1.18 < 1.18.1）。 */
function compareVersions(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** `1.18.*` / `1.18.x` を展開する。ワイルドカードでなければ null。 */
function expandWildcard(token: string, known: readonly string[]): string[] | null {
  const match = token.match(/^(.*?)\.[*x]$/i);
  if (!match) return null;
  const prefix = match[1];
  if (!prefix) return null;
  return known.filter((v) => v === prefix || v.startsWith(prefix + "."));
}

/** `1.19-1.19.2` を展開する。範囲指定でなければ null。 */
function expandRange(token: string, known: readonly string[]): string[] | null {
  const parts = token.split("-");
  if (parts.length !== 2) return null;
  const from = parseVersion(parts[0].trim());
  const to = parseVersion(parts[1].trim());
  if (!from || !to) return null;
  const [lower, upper] = compareVersions(from, to) <= 0 ? [from, to] : [to, from];
  return known.filter((v) => {
    const parsed = parseVersion(v);
    if (!parsed) return false;
    return compareVersions(parsed, lower) >= 0 && compareVersions(parsed, upper) <= 0;
  });
}

/**
 * 入力文字列を既知バージョンの配列へ展開する。
 * 既知バージョンに存在しないものは黙って捨てる（保存時の enum 検証を通すため）。
 * 戻り値は known の並び順・重複なし。
 */
export function expandMcVersionInput(input: string, known: readonly string[]): string[] {
  const matched = new Set<string>();

  for (const raw of input.split(/[,\s]+/)) {
    const token = raw.trim();
    if (!token) continue;

    const expanded = expandWildcard(token, known) ?? expandRange(token, known);
    if (expanded) {
      expanded.forEach((v) => matched.add(v));
      continue;
    }

    const exact = known.find((v) => v.toLowerCase() === token.toLowerCase());
    if (exact) matched.add(exact);
  }

  return known.filter((v) => matched.has(v));
}

/** freeSolo の onChange で得た値（既存の選択済み＋手動入力）をまとめて正規化する。 */
export function normalizeMcVersionValues(values: readonly string[], known: readonly string[]): string[] {
  const matched = new Set<string>();
  for (const value of values) {
    expandMcVersionInput(value, known).forEach((v) => matched.add(v));
  }
  return known.filter((v) => matched.has(v));
}
