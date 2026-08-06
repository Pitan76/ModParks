import type { Env } from "./db";

// Next.jsのHMR（ホットリロード）で再生成されないように、グローバルオブジェクトにキャッシュする
const globalForWrangler = globalThis as unknown as {
  wranglerProxyPromise?: Promise<{ env: Env }>;
};

/**
 * 開発環境 (Next.js Node.js サーバー) でのみ Wrangler Platform Proxy を取得する。
 * getPlatformProxyは実行が非常に重く（SQLiteの起動などを含む）、複数回呼ばれると
 * DBロック競合 (os error 5) や激しいパフォーマンス低下を引き起こすため、
 * シングルトンとしてPromiseをキャッシュして再利用します。
 */
export async function getCachedPlatformProxy(): Promise<{ env: Env }> {
  if (!globalForWrangler.wranglerProxyPromise) {
    globalForWrangler.wranglerProxyPromise = (async () => {
      // webpackにバンドルされないよう動的import時にwebpackIgnoreを指定
      const wrangler = await import(/* webpackIgnore: true */ "wrangler");
      return await wrangler.getPlatformProxy<Env>();
    })();
  }
  return globalForWrangler.wranglerProxyPromise;
}
