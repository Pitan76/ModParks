# modparks-push

Web Push（PWA プッシュ通知）の暗号化と配送を担うサイドカー Worker。メインアプリ（`modparks`）から **Service Binding 経由でのみ**呼ばれ、公開 URL を持たない（`workers_dev = false`）。

本文暗号化（RFC 8291 aes128gcm）と VAPID 署名（RFC 8292 ES256 JWT）を **Web Crypto だけ**で実装している。定番の `web-push` npm は Node.js の `crypto` に依存し Cloudflare Workers では動かないため、ここで隔離している。DB / Cookie / R2 には触れない純粋計算 Worker で、宛先・鍵・本文はすべて呼び出し元から受け取る。

## エンドポイント

`POST` のみ。それ以外は 405、未知のパスは 404。

| パス | リクエスト | レスポンス |
|---|---|---|
| `/send` | `{ subscription, payload, vapid, ttl? }` | `{ ok, status, expired, error? }` |

- `subscription`: `{ endpoint, keys: { p256dh, auth } }`（PushManager の `toJSON()` 形式）
- `payload`: Service Worker の `push` ハンドラへ渡す JSON 文字列
- `vapid`: `{ publicKey, privateKey, subject }`（base64url 鍵とサブジェクト）
- `expired: true` は購読失効（404/410）。呼び出し側が DB から購読を削除する。

## デプロイ

```
cd workers/push
wrangler deploy
```

メインアプリ側は `wrangler.toml` の `[[services]] binding = "PUSH"` で参照する。
