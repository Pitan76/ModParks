# Ideas API

ユーザーから投稿された「欲しい機能」「作ってほしいMOD、プラグイン」などのアイデア（要望）データを取得するためのAPIです。

## リソース表現

アイデアの情報は、以下のようなJSONデータとして表現されます。

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "status": "string",
  "createdAt": "integer",
  "author": {
    "username": "string",
    "displayName": "string",
    "avatarUrl": "string"
  }
}
```

## メソッド一覧

- [アイデア一覧の取得](#アイデア一覧の取得)
- [アイデア詳細の取得](#アイデア詳細の取得)

---

## アイデア一覧の取得

プラットフォーム上で公開されているすべてのアイデアの一覧を取得します。

### HTTP リクエスト

`GET https://modparks.pitan76.net/api/v1/ideas`

### クエリパラメータ

| パラメータ | タイプ | 備考 |
|---|---|---|
| `limit` | integer | 取得する最大件数を指定します。 |
| `offset` | integer | 取得を開始する位置（スキップ件数）を指定します。 |
| `sort` | string | 取得結果の並び順を指定します。`newest`（新着順）などを指定できます。 |

### レスポンス

リクエストが成功すると、アイデア情報の配列を含む以下のJSONが返却されます。

```json
{
  "data": [
    // アイデア情報の配列
  ],
  "meta": {
    "limit": "integer",
    "offset": "integer",
    "count": "integer"
  }
}
```

---

## アイデア詳細の取得

指定したIDに該当するアイデアの詳細情報を取得します。

### HTTP リクエスト

`GET https://modparks.pitan76.net/api/v1/ideas/{id}`

### パスパラメータ

| パラメータ | タイプ | 備考 |
|---|---|---|
| `id` | string | 情報を取得したいアイデアの一意のID。 |

### レスポンス

リクエストが成功すると、対象となるアイデアの全情報（[リソース表現](#リソース表現) と同形式）が返却されます。
