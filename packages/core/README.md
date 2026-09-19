# @modparks/core

Next.js アプリ（リポジトリ直下）と Cloudflare Workers（`workers/*`）の
両方から使う、フレームワーク非依存のドメインロジック。

## 境界のルール

このパッケージは**次のものを import してはならない**。

- `next`, `next/*`（`next/server`, `next/headers`, `next/cache` を含む）
- `next-auth`, `next-intl`
- `@opennextjs/cloudflare`
- `react`, `react-dom`, `@mui/*`, `@emotion/*`
- `server-only`

理由は 2 つある。

1. Workers 側のバンドルへ Next が混入すると、isolate 起動時にその評価 CPU を
   払うことになる。API を Next から切り出す目的そのものが失われる。
2. `next/headers` のようなアンビエントなリクエスト参照は Workers に存在しない。

## env とバインディングの扱い

**core はバインディングを自分で取りに行かない。** 引数で受け取る。

`getCloudflareContext()` や `cookies()` のようなアンビエント取得は、呼び出し側
（Next のルートハンドラ / Server Action、または Hono のハンドラ）が行い、
core には `db` や `Request` を明示的に渡す。

```ts
// GOOD: core 側
export async function findProject(db: Database, slug: string) { ... }

// BAD: core 側
export async function findProject(slug: string) {
  const db = await getDatabase(); // アンビエント取得は Workers で動かない
}
```

## 型だけの例外

`import type` のみの参照は esbuild が除去するため実行時コストを持たない。
現状 `next-auth` の `Session` / `AdapterAccountType` を型として参照している
箇所があるが、値として import してはならない。

## npm workspace にしていない理由

このリポジトリが置かれている E: は **exFAT** で、reparse point を持たないため
ディレクトリの symlink / junction が一切作れない。npm workspaces は
`node_modules/@modparks/core` への symlink で解決するので、`npm install` が
`EISDIR: illegal operation on a directory, symlink` で失敗する。

そのため `@modparks/core` は **node_modules を経由せず、tsconfig の `paths` だけで
解決している**。実体はリポジトリ内のソースなので、Next も wrangler(esbuild) も
一次ソースとしてそのままコンパイルでき、ビルド手順も `transpilePackages` も不要。

参照を追加する場所ごとに `paths` を書く必要がある。現在の登録先:

- `tsconfig.json`（Next アプリ）
- `tsconfig.workers.json`（`npm run typecheck` の workers 側）
- `workers/*/tsconfig.json`（wrangler のバンドル解決用。worker を増やしたら必ず追加する）

リポジトリを NTFS へ移せば workspaces へ移行できる。

## 誰が使うのか

- リポジトリ直下の Next.js アプリ
- `workers/api` — 公開 API。ハンドラ本体（`src/api/v2/**`）を Next の
  ルートハンドラと共有しており、どちらから呼んでも同じ実装が動く
- `workers/jar` — JAR 解析。`src/data/**` を参照する

`workers/*` は core を**バンドルに取り込む**ため、core を変えたら
その Worker も再デプロイが必要になる。`.github/workflows/deploy.yml` の
paths-filter に `packages/core/**` を含めてあるのはそのため。

## アダプタとして Next 側に残しているもの

core が環境に触らない代わりに、アンビエントな取得は Next 側が担う。
対になっているものは次のとおり。

| core | Next 側のアダプタ | 解決するもの |
| --- | --- | --- |
| `db/client.ts` の `getDb(d1)` | `src/lib/db.ts` の `getDatabase()` | `getCloudflareContext()` と dev 用 SQLite |
| `config/readSettings.ts` の `readAppSettings(kv)` | `src/lib/config/readSettings.ts` の `getAppSettings()` | KV バインディング |
| `rate-limit.ts` の `checkRateLimit(db, …)` | `src/lib/rate-limit.ts` | `headers()` と db |
| `queries/masterData.ts` の `selectTags(db)` | `src/lib/queries/masterData.ts` | `unstable_cache` |
| `auth/roles.ts` の `isAdminUser(db, id)` | `src/lib/auth/roles.ts` の `isAdminSession()` | next-auth の Session 型拡張 |
