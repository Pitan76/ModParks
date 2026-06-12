# ModParks 最小要件定義 (MVP)

## 目的

Minecraft Java Edition向けのMod・Pluginを簡単に公開・検索・ダウンロードできるサービスを提供する。

---

## 対象ユーザー

### 投稿者

* 個人開発者
* 学生開発者
* OSS開発者

### 利用者

* Minecraftプレイヤー
* サーバー運営者

---

## 対応コンテンツ

* Mod
* Plugin

---

## 対応Minecraft

* Minecraft Java Edition

---

## アカウント機能

* GitHubログイン
* ログアウト
* プロフィール編集

---

## プロジェクト機能

### 作成

入力項目

* プロジェクト名
* URLスラッグ
* 説明
* アイコン
* タグ
* ライセンス
* ソースコードURL（任意）

### 状態

* 公開
* 非公開

### 編集

* 情報更新
* アイコン変更

---

## バージョン機能

### 登録

入力項目

* バージョン番号
* Minecraftバージョン
* ローダー
* 更新内容

### ダウンロード

方式

* ModParksへアップロード
* 外部URL

外部URL許可先

* GitHub Releases
* Modrinth
* CurseForge

---

## 検索機能

* 名前検索

---

## 閲覧機能

プロジェクトページ

表示項目

* 名前
* 説明
* 作者
* アイコン
* バージョン一覧
* ダウンロードリンク

---

## 通報機能

理由

* 著作権侵害
* マルウェア疑い
* スパム
* その他

---

## 管理機能

* 通報確認
* プロジェクト非公開

---

## 多言語

内部設計のみ対応

* 日本語
* 英語

---

## MVP達成条件

ユーザーが

1. GitHubでログイン
2. ModまたはPluginを投稿
3. 他ユーザーが検索
4. ダウンロード

できること。

---

# ModParks 最大要件定義 (理想形)

## ビジョン

Minecraftを中心に世界中のゲームMod文化を支えるプラットフォームになる。

---

## 対応コンテンツ

* Mod
* Plugin
* Resource Pack
* Data Pack
* Shader
* Modpack
* World
* Addon
* Script
* Tool

---

## 対応ゲーム

* Minecraft Java Edition
* Minecraft Bedrock Edition
* Terraria
* Stardew Valley
* Factorio
* RimWorld
* Cities: Skylines
* Kerbal Space Program
* その他ゲーム

---

## 多言語

投稿

* 日本語
* 英語

閲覧

* AI翻訳対応

対応例

* 日本語
* 英語
* 中国語
* 韓国語
* ドイツ語
* フランス語

---

## AI機能

### 翻訳

説明文自動翻訳

### タグ生成

タグ自動提案

### カテゴリ判定

分類自動提案

### 要約

長文説明の要約

### 不正検知

スパム判定

---

## Git連携

* GitHub連携
* GitLab連携
* Codeberg連携

### リリース同期

GitHub Release

↓

ModParks Version自動作成

---

## API

公開API

* プロジェクト取得
* 検索
* バージョン取得
* ダウンロード取得

---

## ランチャー

### ModParks Launcher

機能

* 検索
* インストール
* アップデート
* Modpack管理

---

## コミュニティ

* コメント
* レビュー
* フォロー
* お気に入り
* 開発日記
* Q&A

---

## 開発者支援

* ダウンロード統計
* 利用者分析
* CI/CD連携
* Webhook

---

## セキュリティ

* ウイルススキャン
* ファイルハッシュ
* 署名検証
* 著作権対応
* 自動審査

---

## 収益化

* 広告
* 寄付
* サブスクリプション
* スポンサー

---

## 最終目標

Minecraft向け日本発サービスとして、

CurseForge と
Modrinth の代替ではなく、

「日本人開発者ならまずModParksに出す」

という状態を目指す。


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
