# ModParks API

ModParks API は、ModParks上のデータにプログラムからアクセスするためのRESTful APIです。

## 基本情報
- **ベースURL**: `https://modparks.pitan76.net/api/v1` (または開発環境のホスト)
- **認証**: 一部のエンドポイント（プロジェクトの作成、更新など）は認証が必要です。リクエストにセッションクッキーを含めるか、`Authorization: Bearer <トークン>` ヘッダーを使用します。

## API リファレンス

各リソースの詳細なエンドポイント、リクエストおよびレスポンスの形式については、以下のドキュメントを参照してください。

- **[Auth & Users API](./api/Auth.md)** : ログイン認証、現在のユーザー情報の取得、プロフィール更新、他のユーザーの検索やフォロー機能。
- **[Projects API](./api/Projects.md)** : 公開プロジェクト（MOD、プラグイン等）の検索、新規作成、および詳細情報の更新機能。
- **[Versions API](./api/Versions.md)** : 特定のプロジェクトに対するバージョン（リリース）ファイル群の取得およびマルチパートによる新規アップロード機能。
- **[Comments API](./api/Comments.md)** : プロジェクトに対するフィードバックやコメントの取得・投稿・編集・削除機能。
- **[Collections API](./api/Collections.md)** : ユーザーが作成したリスト（コレクション）の更新、削除、およびフォロー機能。
- **[Ideas API](./api/Ideas.md)** : ユーザーから投稿されたMOD、プラグイン等のアイデアの取得機能。
