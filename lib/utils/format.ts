/**
 * ダウンロード数などの数値をロケールに合わせてフォーマットします。
 * 日本語の場合は 1万 以上の場合は「万」を使い、それ未満はカンマ区切り (e.g. 5,600)。
 * 英語の場合は 1K, 1M などのK/Mサフィックスを使用します。
 */
export function formatCompactNumber(n: number, locale: string): string {
  if (locale === "ja") {
    if (n >= 10_000) {
      const man = n / 10_000;
      return `${Number.isInteger(man) ? man : man.toFixed(1)}\u2060万`;
    }
    return new Intl.NumberFormat("ja-JP").format(n);
  } else {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
}

/**
 * Minecraftのバージョン一覧（例: ["1.21.2", "1.21.1", "1.21", "1.20.4", "1.20.1"]）を、
 * ["1.21.x", "1.20.4", "1.20.1～1.20"] のようにコンパクトにまとめます。
 */
export function compactMcVersions(versions: string[]): string[] {
  if (!versions || versions.length <= 1) return versions;

  const parsed = versions.map((v) => {
    const parts = v.split(".");
    if (parts.length === 2) {
      return { prefix: v, patch: 0, original: v, isSnapshot: false };
    } else if (parts.length >= 3) {
      const prefix = parts.slice(0, 2).join(".");
      const patch = parseInt(parts[2], 10);
      return { prefix, patch: isNaN(patch) ? -1 : patch, original: v, isSnapshot: isNaN(patch) };
    }
    return { prefix: v, patch: -1, original: v, isSnapshot: true };
  });

  const groups: Record<string, typeof parsed> = {};
  for (const p of parsed) {
    if (!groups[p.prefix]) groups[p.prefix] = [];
    groups[p.prefix].push(p);
  }

  const result: string[] = [];

  const sortedPrefixes = Object.keys(groups).sort((a, b) => {
    const pA = a.split(".").map(Number);
    const pB = b.split(".").map(Number);
    if (pA[0] !== pB[0]) return (pB[0] || 0) - (pA[0] || 0);
    return (pB[1] || 0) - (pA[1] || 0);
  });

  for (const prefix of sortedPrefixes) {
    const group = groups[prefix];
    group.sort((a, b) => b.patch - a.patch);

    let i = 0;
    while (i < group.length) {
      if (group[i].isSnapshot || group[i].patch === -1) {
        result.push(group[i].original);
        i++;
        continue;
      }

      const startIdx = i;
      let endIdx = i;

      while (
        endIdx + 1 < group.length &&
        !group[endIdx + 1].isSnapshot &&
        group[endIdx].patch - group[endIdx + 1].patch === 1
      ) {
        endIdx++;
      }

      const count = endIdx - startIdx + 1;
      if (count >= 4 && group[endIdx].patch === 0) {
        result.push(`${prefix}.x`);
      } else if (count >= 2) {
        result.push(`${group[startIdx].original}～${group[endIdx].original}`);
      } else {
        result.push(group[startIdx].original);
      }

      i = endIdx + 1;
    }
  }

  return result;
}
