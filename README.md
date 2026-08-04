# ModParks
ModParks(モッドパークス)は、マインクラフト(Minecraft Java Edition)向けのMOD/プラグイン配布プラットフォームです。<br />
日本発のプラットフォームとして、開発者の不便を減らし、開発者だけでなくプレイヤーもアイデアを出してプロジェクトに参加できる場を目的としています。

- https://modparks.pitan76.net/

<img width="2400" height="1600" alt="image" src="https://github.com/user-attachments/assets/db2ef835-b0ab-497c-a4a7-cbf9aefd6fde" />


## 特徴
- バージョン管理: バージョンごとのファイルのアップロード、または外部URLへのリンク機能
- 認証: 2FA対応のパスワードログイン、GitHub/Googleアカウントを用いたソーシャルログイン
- アイデアボード: ユーザーが欲しい/作りたいMODのアイデアを投稿、議論し、実現されたプロジェクトと紐付けられる機能
- 記法: Markdown, PlainText, PukiWikiの文法が対応
- インポートと同期: 他プラットフォームからのインポート、DL数同期など
- レシピ抽出: レシピをjarから抽出して一覧として表示する (https://recipe.modparks.pitan76.net/)
- 絞り込み連動DL: 検索中のローダー、MCバージョンの指定に沿ってバージョンを一覧からカードを右クリックしてDL可能

## 技術スタック
- 言語: TypeScript
- フレームワーク: [Next.js](https://nextjs.org/) (App Router, v15)
- UIライブラリ: [MUI v6](https://mui.com/)
- 実行環境: Cloudflare Workers
- データベース: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- ストレージ: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- 認証: [Auth.js (NextAuth v5)](https://authjs.dev/)
- ORM: [Drizzle ORM](https://orm.drizzle.team/)
- I18n: [next-intl](https://next-intl-docs.vercel.app/)
- ソーシャルログイン: GitHub, Google

## ロゴ
<img width="256" height="256" alt="image" src="https://github.com/user-attachments/assets/000b8a58-55f1-4053-8120-d63322a74fbf" />

- M: Minecraft/MOD, P: Publish/Plugin, S: Search

## 開発環境

### 1. 前提条件
- Node.js (v20以上)
- npm, yarn, または pnpm

### 2. リポジトリのクローン
```bash
git clone https://github.com/Pitan76/modparks.git
cd modparks
```

### 3. パッケージのインストール
```bash
# npm
npm install

# bun
bun install
```

### 4. 環境変数の設定
プロジェクトルートにある `.env.local.example` を参考に、`.env.local` を作成してください。
```env
# 例: .env.local
AUTH_SECRET="your-auth-secret" # 任意のランダムな文字列
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"
RECIPE_CDN_SECRET="your-recipe-cdn-secret" # https://recipe.modparks.pitan76.net/ のAPIにアクセスするためのシークレットキー
```

### 5. データベースのセットアップ
ローカルのD1にマイグレーションを適用します。
```bash
npm run db:generate
npm run db:migrate:local
```

### 6. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスして確認してください。

## フォルダ構成
- `app/`: Next.js App Router (ルーティング, Server Components)
- `components/`: 再利用可能なReactコンポーネント (UI, フォーム等)
- `db/`: Drizzle ORM のスキーマ定義 (`schema.ts`)
- `lib/`: データベース接続 (`db.ts`), APIクライアント, アクション群, バリデーション等
- `lib/data/`: 外部依存を持たない純粋なドメインデータ (MCバージョン一覧, ローダー定義)
- `messages/`: `next-intl` 向けの翻訳ファイル (`ja_jp.json`, `en_us.json`)
- `workers/`: メインアプリとは別にデプロイする Cloudflare Worker 群

## サイドカー Worker (`workers/jar`)
jar/zipの解析処理は、メインアプリではなく **`modparks-jar` という別 Worker** で動いています。

### なぜ分けているか
Cloudflare Workers の無料プランには 1 Worker あたり 3072 KiB (gzip) というスクリプトサイズ上限があり、本体はここに張り付いています。
jarを開くための `jszip` はサーバーバンドルにRSC+SSRで複数コピー入るため、単体で100KiB以上を占めていました。

本体バンドルの約8割はNext.jsのランタイムでした。サイドカーはランタイム負担がほぼゼロなので、重量ライブラリの隔離先として機能します。

### 構成

| パス | 役割 |
|---|---|
| `workers/jar/src/index.ts` | ルーティング (`/parse-mod`, `/extract-recipes`) |
| `workers/jar/src/parseMod.ts` | jarからバージョン、ローダー、対応MCバージョンを検出 |
| `workers/jar/src/recipeExtract.ts` | レシピ/タグ/テクスチャ/モデルの抽出 |
| `workers/jar/src/recipeUpload.ts` | レシピCDNへの bulk 送出、または R2 への直接書き込み |
| `workers/jar/src/types.ts` | 入出力の型定義。**実装や依存を一切含まない** |
| `lib/services/jar.ts` | メインアプリ側の呼び出しクライアント |

メインアプリからは Service Binding (`JAR`) 経由で呼びます。
`workers/jar/src/types.ts` が型だけを持つことで、メインアプリがこの契約を `import type` しても
`jszip` がバンドルに混入しないようになっています。

呼び出し時は **JAR のバイト列を渡さず、R2 キーか URL だけを渡して Worker 側に取得させます**。
数十MBのバッファが両 Worker のメモリに二重に載るのを避けるためです。

### 制約

- このWorkerはURLとして外部公開してはなりません (`workers_dev = false`, routes なし)。
  `/extract-recipes` は R2 と CDN への書き込みを行うため、公開すると誰でも任意の内容を書き込めるため。
- **`workers/jar/` から親の `@/...` を import しないこと。** 将来この Worker を
  別リポジトリ (git submodule) に切り出せる状態を保つためです。
  共有が必要なドメインデータは `lib/data/` に置き、相対パスで参照します。

### デプロイ

メインアプリの Service Binding が解決できないため、**サイドカーを先にデプロイ**します。

```bash
cd workers/jar
npx wrangler deploy
npx wrangler secret put RECIPE_CDN_SECRET
```

## プッシュ通知

アプリ内通知（`dispatchNotifications`）に相乗りして、ブラウザ/ホーム画面アプリへ Web Push を配信します。種別ごとの受信可否は既存の通知設定（`notificationPrefs`）を尊重し、端末単位の ON/OFF は設定 →「通知」タブのトグルで行います。

- 本文暗号化（RFC 8291 aes128gcm）と VAPID 署名（RFC 8292）は Node crypto 依存の `web-push` が Workers で動かないため、`workers/push`（`modparks-push`）サイドカーに Web Crypto 実装として隔離しています。
- iOSはホーム画面に追加したPWAでのみプッシュを受信できます（iOS 16.4+、Safari のタブ状態では不可）。

### セットアップ

1. VAPID 鍵ペアを生成:

   ```bash
   node scripts/generate-vapid.mjs
   ```

2. 公開鍵を `wrangler.toml` の `[vars]` に設定（クライアント購読に使うため公開してよい）:

   ```toml
   NEXT_PUBLIC_VAPID_PUBLIC_KEY = "B..."
   VAPID_PUBLIC_KEY             = "B..."
   ```

3. 秘密鍵とサブジェクトはシークレットとして登録:

   ```bash
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put VAPID_SUBJECT   # mailto: か https: の連絡先
   ```

4. サイドカーを**先に**デプロイしてから本体をデプロイ（Service Binding 解決のため）:

   ```bash
   cd workers/push && npx wrangler deploy
   ```

VAPID が未設定の場合、Web Push はスキップされアプリ内通知だけが動きます。ローカル開発では `wrangler dev` のシークレット供給（`.dev.vars`）に同じ値を入れてください。

## 右クリックメニュー
カードやサイドバーなどで右クリックすることで独自のコンテキストメニューを表示します。<br>
オフにしたい場合はコンテキストメニューから、または設定から変更可能です。