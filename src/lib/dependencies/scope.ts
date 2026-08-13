/**
 * 依存関係の適用範囲（プラットフォーム）の判定。
 *
 * DBには versions.loaders と同じ JSON 文字列配列で入るが、
 * 空・null・壊れた値のいずれも「全プラットフォーム」に倒す。
 * 前提 MOD を出し損ねるより、余分に出す方が害が小さいため。
 */
import { toStringArray } from "@/lib/utils/format";

/** DB の loaders 列を配列に開く。空・null・壊れた値はすべて空配列 */
export function parseDependencyLoaders(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  try {
    return toStringArray(raw).filter((loader) => typeof loader === "string" && loader.length > 0);
  } catch {
    return [];
  }
}

/**
 * その依存が、指定のプラットフォームを持つバージョンに要るか。
 *
 * 依存側にプラットフォーム指定が無ければ、どのバージョンにも要る。
 * 指定がある場合は、バージョンのローダーと 1 つでも重なれば要る
 * （例: Fabric 指定の Fabric API は、fabric 対応のバージョンにだけ出す）。
 */
export function dependencyAppliesToLoaders(dependencyLoaders: string[], versionLoaders: string[]): boolean {
  if (dependencyLoaders.length === 0) return true;
  return dependencyLoaders.some((loader) => versionLoaders.includes(loader));
}
