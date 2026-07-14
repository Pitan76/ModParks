# ModParks CLI 🛠️

ModParks CLIは、コマンドラインから直接ModParksプラットフォームと連携し、プロジェクトの管理やバージョンの公開を自動化するための公式ツールです。

## 🎯 なぜCLIが必要なのか？

MODやプラグインの開発者は、日々の開発作業においてビルドスクリプト（Gradle, Maven, Node.js等）を使用しています。ModParks CLIを導入することで、開発者はブラウザを開いて手動でファイルをアップロードする手間を省き、**ビルドから公開までのワークフローを完全に自動化**（CI/CDパイプラインとの統合）することができます。

## 📦 インストール方法

Node.js環境（v18以降推奨）がインストールされている必要があります。

```bash
# グローバルにインストールする場合
npm install -g modparks-cli

# プロジェクトの devDependencies としてインストールする場合
npm install -D modparks-cli
```

## 🚀 コマンドリファレンス（予定仕様）

### `modparks login`
ModParks APIに接続するための認証トークンを設定します。

```bash
modparks login --token <YOUR_API_TOKEN>
```
*※トークンはユーザー設定画面の「API Key」タブから発行できます。*

### `modparks init`
カレントディレクトリにModParks用の設定ファイル（`modparks.json` または `modparks.toml`）を生成する対話型コマンドです。
プロジェクトのSlug、デフォルトのローダー、対応バージョンなどを記録し、以後のコマンドを簡略化します。

```bash
modparks init
```

### `modparks publish`
ビルドされた成果物（.jar ファイルなど）をModParks上の新しいバージョンとしてアップロード・公開します。

```bash
# 基本的な使用例（引数で指定）
modparks publish --file build/libs/my-mod-1.0.0.jar \
  --version "1.0.0" \
  --mc-version "1.20.1" \
  --loader "fabric" \
  --changelog "CHANGELOG.md" \
  --release-type "release"

# 設定ファイル (modparks.json) がある場合
modparks publish
```

### `modparks sync`
ローカルのプロジェクトメタデータ（README.mdなど）と、ModParks上のプロジェクト設定を同期させます。

```bash
modparks sync --push   # ローカルの設定をサーバーに反映
modparks sync --pull   # サーバーの設定をローカルに反映
```

## ⚙️ CI/CDでの活用例 (GitHub Actions)

`modparks publish` はCI環境での利用を強く意識して設計されています。以下はGitHub Actionsを使用して、リリース作成時に自動でModParksへ公開するワークフローの例です。

```yaml
name: Publish to ModParks

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
      
      - name: Build with Gradle
        run: ./gradlew build

      - name: Install ModParks CLI
        run: npm install -g modparks-cli

      - name: Publish to ModParks
        env:
          MODPARKS_TOKEN: ${{ secrets.MODPARKS_API_TOKEN }}
        run: |
          modparks publish \
            --file build/libs/my-mod.jar \
            --mc-version "1.20.1" \
            --loader "fabric" \
            --release-type "release"
```

*※本ツールは現在開発・構想段階であり、コマンド体系や仕様は変更される可能性があります。*
