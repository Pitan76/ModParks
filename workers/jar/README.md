# modparks-jar

Mod の JAR を解析するサイドカー Worker。メインアプリ（`modparks`）から **Service Binding 経由でのみ**呼ばれ、公開 URL を持たない。

`jszip` を含む重い依存はこの Worker にのみ存在する。メイン Worker の 3 MiB 制限を超えないようにするための分離であり、メイン側は [`src/types.ts`](src/types.ts) を `import type` するだけで実装を参照しない。

## エンドポイント

いずれも `POST` のみ。それ以外は 405、未知のパスは 404。

| パス | リクエスト | レスポンス |
|---|---|---|
| `/parse-mod` | `{ source }` | `{ detectedVersion, detectedLoaders, detectedMcVersions }` |
| `/extract-recipes` | `{ source, cdnUrl, useCdnApi }` | `{ count, namespaces }` |

`source` は `{ kind: "r2", key }` または `{ kind: "url", url }`。JAR のバイト列は Worker 間を跨がず、この Worker 自身が取得する。

失敗時は `{ error: string }` を 500 で返す。

### `useCdnApi` の違い

- `true` … レシピ CDN の bulk API へ POST する（`RECIPE_CDN_SECRET` が必要）。インデックスは CDN 側が管理する
- `false` … R2 バインディングへ直接書き、`index/recipes.json` もこの Worker が更新する

どちらの経路も送出順は **textures → models → tags → recipes** で固定。レシピが先に入るとテクスチャ未着の透明アイコンが焼き付くため、名前空間をまたいでフェーズ単位に進める（mod のレシピが `minecraft:` を参照するため、ns ごとの順序では不十分）。

## バインディング

| 名前 | 種別 | 用途 |
|---|---|---|
| `modparks_storage` | R2 | メインアプリと同一バケット（`modparks-storage`） |
| `RECIPE_CDN_SECRET` | Secret（任意） | CDN bulk API の `Authorization: Bearer` |

## デプロイ

### 前提

- Node.js 22
- `npx wrangler login`（または `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を環境変数で）
- R2 バケット `modparks-storage` が作成済みであること

### 手動デプロイ

このディレクトリで実行する。リポジトリルートの `wrangler.toml` はメインアプリ用なので、必ず `workers/jar` から叩くこと。

```bash
cd workers/jar
npx wrangler deploy
```

シークレットの設定（初回、および値の更新時のみ）:

```bash
npx wrangler secret put RECIPE_CDN_SECRET
```

型チェック（デプロイ前に通しておく）:

```bash
npx tsc --noEmit -p workers/jar   # リポジトリルートから
```

### 自動デプロイ

`main` への push で [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) が走り、**この Worker → メイン Worker** の順にデプロイされる。メイン側が `modparks-jar` を Service Binding するため、サイドカーが先である必要がある。

必要な GitHub Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`。

### デプロイ順序の注意

- **この Worker が存在しない状態でメインをデプロイすると、Service Binding の解決に失敗する。** 新規環境では必ずこちらを先に出す
- [`src/types.ts`](src/types.ts) を破壊的に変更する場合、メインアプリとこの Worker は別デプロイなので一時的にバージョンがずれる。フィールド追加は後方互換に、削除・改名は 2 段階（追加 → 移行 → 削除）で行う

## ローカル開発

```bash
cd workers/jar
npx wrangler dev
```

メインアプリからの Service Binding をローカルで繋ぐ場合は、この Worker を `wrangler dev` で起動したうえで、ルートの `npm run cf:dev` を別プロセスで動かす。

## 確認

デプロイ後、Service Binding 経由でしか到達できないため URL では叩けない。動作確認はメインアプリの mod バージョン登録（JAR アップロード）から行い、ログは以下で見る。

```bash
npx wrangler tail modparks-jar
```
