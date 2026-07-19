# ModParks
ModParksは、マインクラフト(Minecraft Java Edition)向けのMOD、プラグイン配布プラットフォームです。<br />
日本発のプラットフォームとして、開発者とプレイヤーがより円滑に作品を共有し、コミュニケーションできる場を提供することを目的としています。

## 特徴
- プロジェクトの公開と探索: MODやプラグインを検索、発見、ダウンロード。
- バージョン管理: バージョンごとのJar/Zipファイルのアップロード、または外部URL（GitHub Releases, Modrinth, CurseForge 等）へのリンク機能。
- 多言語対応: 日本語と英語の表示切り替え。
- 認証: GitHub アカウントを用いたログイン。
- アイデアボード: ユーザーが「こんなMODが欲しい！」を投稿・議論し、実現されたプロジェクトと紐付けられる機能。
- 記法: Markdown, PlainText, PukiWikiの文法が対応
- インポートと同期機能: 他のプラットフォームとの連携が強み。インポートはもちろんDL数同期なども
- レシピ抽出機能: レシピをjarから抽出して一覧として表示する (https://recipe.modparks.pitan76.net/)

## 技術スタック
- **フレームワーク**: [Next.js](https://nextjs.org/) (App Router, v15)
- **言語**: TypeScript
- **スタイリング / UI**: [MUI v6](https://mui.com/)
- **データベース**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **ストレージ**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **認証**: [Auth.js (NextAuth v5)](https://authjs.dev/)
- **多言語化**: [next-intl](https://next-intl-docs.vercel.app/)

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
- `messages/`: `next-intl` 向けの翻訳ファイル (`ja_jp.json`, `en_us.json`)

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
