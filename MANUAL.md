# ModParks Cloudflare デプロイマニュアル

このドキュメントでは、ModParks を Cloudflare Pages / D1 / R2 を用いて本番環境にデプロイする手順を説明します。

---

## 1. 事前準備
以下の要件を満たしていることを確認してください。

- **Node.js** (v18以降)
- **Wrangler CLI** (`npm install -g wrangler`)
- **Cloudflare アカウント**（ダッシュボードにログインできること）
- **GitHub アカウント**（GitHub OAuthアプリの作成に必要）

npx wrangler pages project create modparks

---

## 2. Cloudflare D1 (データベース) のセットアップ

本番環境用のデータベースを作成します。

```bash
# データベースの作成
npx wrangler d1 create modparks-db
```

出力される `database_name` と `database_id` を控え、プロジェクトルートの `wrangler.toml` を更新します。

```toml
[[d1_databases]]
binding = "DB"
database_name = "modparks-db"
database_id = "ここに取得したIDを貼り付け"
```

### スキーマとマイグレーションの適用
本番環境のデータベースにテーブルを作成します。

```bash
npm run db:migrate:prod
# もしくは: npx wrangler d1 migrations apply modparks-db --remote
```

---

## 3. Cloudflare R2 (オブジェクトストレージ) のセットアップ

画像やファイル（Mod/Pluginファイル、アイコンなど）の保存先を作成します。

```bash
# バケットの作成
npx wrangler r2 bucket create modparks-storage
```

`wrangler.toml` の R2 設定が以下と一致していることを確認します。

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "modparks-storage"
```

### パブリックアクセスの有効化（オプションですが推奨）
Cloudflareダッシュボードの R2 設定から `modparks-storage` を選択し、「設定」タブから「R2.dev サブドメインを許可する」または「カスタムドメイン」を設定し、公開URLを取得します。

https://pub-2695d39dce7f4e15a14414ab174b3805.r2.dev

---

## 4. GitHub OAuth アプリの作成 (認証用)

ユーザーのログインには GitHub OAuth を使用します。

1. GitHubの設定 -> Developer settings -> OAuth Apps にアクセス
2. **New OAuth App** をクリック
3. 以下の情報を入力:
   - Application name: `ModParks` (任意)
   - Homepage URL: `https://あなたのドメイン`
   - Authorization callback URL: `https://あなたのドメイン/api/auth/callback/github`
4. **Client ID** と **Client Secret** を取得し、控えておきます。

---

## 5. NextAuth (Auth.js) シークレットの生成

セッション暗号化用のランダムな文字列を生成します。

```bash
# opensslを使うか、以下のコマンドで生成できます
openssl rand -base64 32
```
生成された文字列を `AUTH_SECRET` として控えます。

---

## 6. Cloudflare Workers へのデプロイ

### 6-1. 環境変数の設定
Wranglerを使って、本番環境のシークレット（環境変数）をWorkersプロジェクトに対して設定します。

```bash
npx wrangler secret put AUTH_GITHUB_ID
npx wrangler secret put AUTH_GITHUB_SECRET
npx wrangler secret put AUTH_SECRET
npx wrangler secret put NEXT_PUBLIC_BASE_URL
npx wrangler secret put R2_PUBLIC_URL
```
※ `NEXT_PUBLIC_BASE_URL` は `https://あなたのドメイン` です。
※ `R2_PUBLIC_URL` は手順3で取得したパブリックアクセス用のURLです。

### 6-2. プロジェクトのビルドとデプロイ
OpenNextを用いてNext.jsのビルドを行い、Cloudflare Workersにデプロイします。

npm install -D @opennextjs/cloudflare

```bash
# ビルドとデプロイを実行（package.json に定義されたスクリプト）
npm run cf:deploy
```

※ 初回デプロイ時はプロジェクト名の入力が求められます。`modparks` のように設定してください。

---

## 7. トラブルシューティング

### ログイン後にリダイレクトが失敗する
GitHub OAuth の設定画面で `Authorization callback URL` が正しいドメイン（`https://modparks.your-workers.dev/api/auth/callback/github` 等）と完全に一致しているか確認してください。

### 画像が表示されない、ダウンロードができない
R2 のパブリックアクセス設定が正しく行われているか、環境変数の `R2_PUBLIC_URL` に末尾のスラッシュ（`/`）が入っていないか確認してください。

### データベースエラー
本番のD1にマイグレーションが反映されているか確認してください。
`npx wrangler d1 execute modparks-db --remote --command="SELECT * FROM users;"` などでテストクエリを実行できます。
