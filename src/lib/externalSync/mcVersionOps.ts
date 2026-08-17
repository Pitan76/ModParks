export type McVersionOperation = "add" | "remove" | "set";

/**
 * 対応MCバージョン配列へ操作を適用した結果を返す純粋関数。
 *
 * modparks内のバージョン(mcVersions列)・Modrinthのgame_versions・CurseForgeのgameVersions、
 * いずれも「現在の一覧」+「操作」+「対象バージョン群」という同じ形で更新できるため、
 * ここに集約して3箇所で同じ判定がずれないようにする。
 */
export function applyMcVersionOperation(current: string[], operation: McVersionOperation, mcs: string[]): string[] {
  if (operation === "add") return [...new Set([...current, ...mcs])];
  if (operation === "remove") return current.filter((mc) => !mcs.includes(mc));
  return [...new Set(mcs)];
}
