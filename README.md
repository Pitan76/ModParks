# ModParks

**ModParks** は、Minecraft Java Edition 向けの Mod および Plugin プラットフォームです。
日本発のプラットフォームとして、開発者とプレイヤーがより円滑に作品を共有し、コミュニケーションできる場を提供することを目的としています。

## 特徴 (Features)

- **プロジェクトの公開と探索**: ModやPluginを検索、発見、ダウンロード。
- **バージョン管理**: バージョンごとのJar/Zipファイルのアップロード（Cloudflare R2対応）または外部URL（GitHub Releases, Modrinth, CurseForge 等）へのリンク機能。
- **多言語対応 (i18n)**: 日本語と英語の表示切り替え（`next-intl` による実装）。
- **認証**: GitHub アカウントを用いたセキュアなログイン（Auth.js / NextAuth）。
- **アイデアボード**: ユーザーが「こんなModが欲しい！」を投稿・議論し、実現されたプロジェクトと紐付けられる機能。
- **通報システム**: ガイドライン違反のプロジェクトを管理者に報告する機能。

## 技術スタック (Tech Stack)

- **Framework**: [Next.js](https://nextjs.org/) (App Router, v15)
- **Language**: TypeScript
- **Styling / UI**: [Material-UI (MUI v6)](https://mui.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **Authentication**: [Auth.js (NextAuth v5)](https://authjs.dev/)
- **i18n**: [next-intl](https://next-intl-docs.vercel.app/)

## ローカル開発環境のセットアップ (Getting Started)

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

*注意: ローカル開発環境では `wrangler.getPlatformProxy` のキャッシュ機構 (`lib/proxy.ts`) によって、Next.jsのホットリロード時にも重いプロキシインスタンスの再起動が防がれ、軽快に動作するよう設計されています。*

## フォルダ構成

- `app/`: Next.js App Router (ルーティング, Server Components)
- `components/`: 再利用可能なReactコンポーネント (UI, フォーム等)
- `db/`: Drizzle ORM のスキーマ定義 (`schema.ts`)
- `lib/`: データベース接続 (`db.ts`), APIクライアント, アクション群, バリデーション等
- `messages/`: `next-intl` 向けの翻訳ファイル (`ja.json`, `en.json`)

## ライセンス (License)

このプロジェクトは [MIT License](LICENSE) の元に公開されています。

## タスク
- Modrinth、CurseForgeとの連携
- 非ログイン時でもお気に入りに入れることができるようにする（クッキーによる管理）
- フロントエンドとバックエンドを完全にわけるためにあらかじめ、APIを固めておく
- 利用規約、プライバシーポリシーを作成する

