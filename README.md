# ModParks
ModParksは、マインクラフト(Minecraft Java Edition)向けのMOD、プラグイン配布プラットフォームです。<br />
日本発のプラットフォームとして、開発者とプレイヤーがより円滑に作品を共有し、コミュニケーションできる場を提供することを目的としています。

<img width="1307" height="773" alt="image" src="https://github.com/user-attachments/assets/a902929c-cc75-4bf3-b90d-b83903dfa7ce" />

<img width="1301" height="776" alt="image" src="https://github.com/user-attachments/assets/bf7ff7d3-f5fc-47be-b9a9-c506ef1fbb24" />


## 特徴
- プロジェクトの公開と探索: MODやプラグインを検索、発見、ダウンロード。
- バージョン管理: バージョンごとのJar/Zipファイルのアップロード、または外部URL（GitHub Releases, Modrinth, CurseForge 等）へのリンク機能。
- 多言語対応: 日本語と英語の表示切り替え。
- 認証: 2FA対応の通常ログインとGitHubアカウントを用いたソーシャルログイン。
- アイデアボード: ユーザーが「こんなMODが欲しい！」を投稿・議論し、実現されたプロジェクトと紐付けられる機能。
- 記法: Markdown, PlainText, PukiWikiの文法が対応
- インポートと同期機能: 他のプラットフォームとの連携が強み。インポートはもちろんDL数同期なども
- レシピ抽出機能: レシピをjarから抽出して一覧として表示する (https://recipe.modparks.pitan76.net/)
- 絞り込み連動ダウンロード: 検索中のローダー・MCバージョン条件に合う版を、一覧から直接ワンクリックで取得。

## 技術スタック
- **フレームワーク**: [Next.js](https://nextjs.org/) (App Router, v15)
- **言語**: TypeScript
- **スタイリング / UI**: [MUI v6](https://mui.com/)
- **データベース**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **ストレージ**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **認証**: [Auth.js (NextAuth v5)](https://authjs.dev/)
- **多言語化**: [next-intl](https://next-intl-docs.vercel.app/)
- **実行環境**: Cloudflare Workers

## ローカル開発環境のセットアップ

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
npm install
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

### 5. データベースのセットアップ（ローカルD1）
ローカル開発用の D1 データベースにマイグレーションを適用します。
```bash
npm run db:generate
npm run db:migrate:local
```

### 6. 開発サーバーの起動
```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスして確認してください。

※ローカル開発環境では `wrangler.getPlatformProxy` のキャッシュ機構 (`lib/proxy.ts`) によって、Next.jsのホットリロード時にも重いプロキシインスタンスの再起動が防がれ、軽快に動作するよう設計されています。

## フォルダ構成
- `app/`: Next.js App Router (ルーティング, Server Components)
- `components/`: 再利用可能なReactコンポーネント (UI, フォーム等)
- `db/`: Drizzle ORM のスキーマ定義 (`schema.ts`)
- `lib/`: データベース接続 (`db.ts`), APIクライアント, アクション群, バリデーション等
- `lib/data/`: 外部依存を持たない純粋なドメインデータ (MCバージョン一覧, ローダー定義)
- `messages/`: `next-intl` 向けの翻訳ファイル (`ja_jp.json`, `en_us.json`)
- `workers/`: メインアプリとは別にデプロイする Cloudflare Worker 群

## サイドカー Worker (`workers/jar`)

JAR/ZIP の解析処理は、メインアプリではなく **`modparks-jar` という別 Worker** で動いています。

### なぜ分けているか

Cloudflare Workers の無料プランには **1 Worker あたり 3072 KiB (gzip)** というスクリプトサイズ上限があり、
本体はここに張り付いています。JAR を開くための `jszip` はサーバーバンドルに
RSC 用 + SSR 用で複数コピー入るため、単体で 100 KiB 以上を占めていました。

重要なのは、**この問題はアプリを機能ごとに分割しても解決しない**という点です。
本体バンドルの約 8 割は Next.js のランタイムであり、admin などを別 Worker に切り出しても
両方が同じランタイムを丸ごと抱えるだけでサイズは減りません。
対して素の Worker であるサイドカーはランタイム負担がほぼゼロなので、
重量ライブラリの隔離先として機能します。今後また上限に迫った場合も、同じ形で逃がすのが定石です。

### 構成

| パス | 役割 |
|---|---|
| `workers/jar/src/index.ts` | ルーティング (`/parse-mod`, `/extract-recipes`) |
| `workers/jar/src/parseMod.ts` | JAR からバージョン・ローダー・対応MCバージョンを検出 |
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

- **この Worker は公開していません** (`workers_dev = false`, routes なし)。
  `/extract-recipes` は R2 と CDN への書き込みを行うため、公開すると誰でも任意の内容を書き込めてしまいます。
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

## 右クリックメニュー

`components/ui/ContextMenu/` に、右クリックで独自コンテキストメニューを出す基盤があります（Chrome のネイティブメニューを妨害しない設計）。詳細・使い方はそちらの 

配線済み: `ProjectCard` / `ProjectVersionsTable`（バージョン行・モバイルカード） / `CollectionCard` / `IdeaCard`。

### 今後増やせる箇所（候補）
- **プロフィール / ユーザー行** — フォロー・プロフィールコピー
- **通知アイテム** — 既読・該当ページへ
- **プロジェクトコメント / アイデアコメント** — 返信・リンクコピー・報告
- **依存関係リスト・タグ Chip** — そのタグで絞り込み
- **プロジェクト詳細ヘッダー** — お気に入り・購読・共有

いずれも `useContextMenu` + `useCommonItems` で数行。owner限定操作は `items` の関数形式 `(target) => [...]` で出し分ける。
