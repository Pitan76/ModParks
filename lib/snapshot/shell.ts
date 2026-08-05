/**
 * 描画シェルを R2 へ複製する。
 *
 * シェルの正は `public/archive/`（Static Assets）で、手で二重管理はしない。
 * ここは archive ホスト単独でも開けるようにするための写しを作るだけ。
 *
 * Static Assets は Worker を起動しないため、読み出し自体は枠を消費しない。
 */
/** 複製するファイル。増やすときは public/archive/ に置いてからここへ足す */
const SHELL_FILES = [
  { path: "index.html", contentType: "text/html; charset=utf-8" },
  { path: "app.js", contentType: "text/javascript; charset=utf-8" },
  { path: "app.css", contentType: "text/css; charset=utf-8" },
  { path: "strings.json", contentType: "application/json; charset=utf-8" },
];

/**
 * シェルは archive のルート直下に置く。
 * データ（v1/）と混ぜないことで、スキーマ更新時に消さずに済む。
 */
function shellKey(path: string): string {
  return path;
}

async function getAssets(): Promise<Fetcher | null> {
  const env = await resolveEnv();
  return (env as { ASSETS?: Fetcher }).ASSETS ?? null;
}

async function resolveEnv(): Promise<unknown> {
  if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
    const { getCachedPlatformProxy } = await import("@/lib/proxy");
    return (await getCachedPlatformProxy()).env;
  }

  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  return (await getCloudflareContext({ async: true })).env;
}

/**
 * `public/archive/` の内容を R2 へ写す。
 *
 * Static Assets から読めない環境（ローカルなど）では何もしない。
 * シェルはデータより更新頻度が低く、写せなくてもデータ生成は成立する。
 *
 * @returns 複製したファイル数
 */
export async function copyShell(bucket: R2Bucket): Promise<number> {
  const assets = await getAssets();
  if (!assets) return 0;

  let copied = 0;
  for (const file of SHELL_FILES) {
    // 1 ファイルの失敗で残りを止めない。部分的にでも新しい方がよい
    try {
      const res = await assets.fetch(`https://assets.invalid/archive/${file.path}`);
      if (!res.ok) continue;

      await bucket.put(shellKey(file.path), await res.arrayBuffer(), {
        httpMetadata: { contentType: file.contentType, cacheControl: "public, max-age=300" },
      });
      copied++;
    } catch (err) {
      console.error(`[SNAPSHOT] Failed to copy shell file ${file.path}:`, err);
    }
  }

  return copied;
}
