export type VersionTargetOptions<T> = {
  /** そのバージョンが対応するローダー一覧 */
  loadersOf: (item: T) => string[];
  /** 新旧比較に使う時刻（epoch ミリ秒） */
  publishedAtOf: (item: T) => number;
  /** 絞り込むローダー。空なら全ローダーを対象にする */
  platforms: string[];
  targetVersions: "all" | "latest";
};

const normalize = (values: string[]) => values.map((v) => v.trim().toLowerCase()).filter(Boolean);

/**
 * 一括編集の対象バージョンを選ぶ。
 *
 * ローダーを指定したときの "latest" は、指定した**ローダーごとの最新**を選ぶ。
 * Fabric と Forge で別ビルドを出しているプロジェクトで全体の最新 1 件だけを見ると、
 * 片方のローダーが取り残されてしまうため。
 *
 * modparks の versions と Modrinth のバージョン一覧で同じ判断が要るので、
 * 取り出し方だけ差し替えられる形にして共通化している。
 */
export function selectVersionTargets<T>(items: T[], opts: VersionTargetOptions<T>): T[] {
  const { loadersOf, publishedAtOf, targetVersions } = opts;
  const platforms = normalize(opts.platforms);

  const matches = platforms.length === 0
    ? items
    : items.filter((item) => normalize(loadersOf(item)).some((l) => platforms.includes(l)));

  if (targetVersions === "all") return matches;
  if (matches.length === 0) return [];

  const newest = (list: T[]) => list.reduce((a, b) => (publishedAtOf(b) > publishedAtOf(a) ? b : a));

  if (platforms.length === 0) return [newest(matches)];

  const picked: T[] = [];
  for (const platform of platforms) {
    const forPlatform = matches.filter((item) => normalize(loadersOf(item)).includes(platform));
    if (forPlatform.length === 0) continue;
    const latest = newest(forPlatform);
    if (!picked.includes(latest)) picked.push(latest);
  }
  return picked;
}
