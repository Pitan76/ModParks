# ModParks OAuth 2.0 / OpenID Connect

ModParks は認可サーバーとして動作します。外部プラットフォームは
Authorization Code + PKCE でユーザーの同意を得て、ModParks API を本人として呼べます。
`openid` スコープを付ければ「ModParks でログイン」（ソーシャルログイン）としても使えます。

## エンドポイント

| 役割 | URL |
| --- | --- |
| ディスカバリ | `/.well-known/openid-configuration`（`/.well-known/oauth-authorization-server` も同内容） |
| 認可 | `/api/oauth/authorize` |
| トークン | `/api/oauth/token` |
| ユーザー情報 | `/api/oauth/userinfo` |
| 失効 | `/api/oauth/revoke` |
| 公開鍵 | `/api/oauth/jwks` |

## アプリの登録

設定 → 開発者設定 → OAuthアプリ から登録します。

- **リダイレクトURI**: 完全一致で照合します。https のみ（localhost に限り http 可）。
- **機密クライアント**: サーバーでシークレットを保持できる場合にチェックします。
  外さない場合（公開クライアント）は PKCE が必須になります。
- **client_secret** は登録時と再発行時にしか表示されません。

## フロー

```
1. GET /api/oauth/authorize
     ?response_type=code
     &client_id=mpc_xxx
     &redirect_uri=https://example.com/callback
     &scope=openid%20profile:read%20projects:write
     &state=<CSRF対策のランダム値>
     &code_challenge=<S256(code_verifier)>
     &code_challenge_method=S256

2. 未ログインならログイン画面 → 同意画面 → redirect_uri へ ?code=...&state=...

3. POST /api/oauth/token  (application/x-www-form-urlencoded)
     grant_type=authorization_code
     &code=...
     &redirect_uri=https://example.com/callback
     &code_verifier=...
     （機密クライアントは Authorization: Basic base64(client_id:client_secret)）

   → { access_token, token_type: "Bearer", expires_in, refresh_token, scope, id_token? }

4. API 呼び出し: Authorization: Bearer <access_token>
```

リフレッシュは `grant_type=refresh_token&refresh_token=...`。
リフレッシュトークンはローテーションし、使用済みの再提示を検知したら
そのユーザー×クライアントのトークンをすべて失効させます。

## スコープ

| スコープ | 内容 |
| --- | --- |
| `openid` | ログイン用途。id_token が発行される |
| `email` | メールアドレスの取得 |
| `profile:read` | 表示名・ユーザー名・アイコン |
| `projects:read` / `projects:write` | プロジェクトの読み取り / 作成・編集 |
| `versions:read` / `versions:write` | バージョンの読み取り / 追加・編集 |
| `ideas:read` / `ideas:write` | アイデアの読み取り / 作成・編集 |
| `comments:write` | コメント投稿 |
| `notifications:read` | 通知の読み取り |

追加するときは `lib/oauth/scopes.ts` と `lang/*.json` の
`Settings.oauthApps.scopeLabels` / `OAuth.scopes` を必ず対で更新してください。

## 有効期限

| 対象 | 期限 |
| --- | --- |
| 認可コード | 10 分・1回限り |
| アクセストークン | 1 時間 |
| リフレッシュトークン | 90 日（ローテーションあり） |

## 運用に必要な設定

`id_token` の署名には ES256 の秘密鍵 JWK が必要です。
Cloudflare のシークレットに `OAUTH_ID_TOKEN_KEY` として JSON 文字列で登録してください
（`kid` を含めておくと鍵の入れ替えが楽になります）。
未設定でもアクセストークンの発行は動きますが、`id_token` は付きません。

鍵の生成と登録:

```bash
# 秘密鍵 JWK を1行で出力する（画面に出た値がそのままシークレットの中身）
node scripts/generate-oauth-key.mjs

# 本番へ登録（プロンプトに上の出力を貼る）
npx wrangler secret put OAUTH_ID_TOKEN_KEY

# ローカル開発は .dev.vars に
# OAUTH_ID_TOKEN_KEY={"kty":"EC",...}
```

公開鍵は秘密鍵から導出して `/api/oauth/jwks` が配るため、別途登録する必要はありません。
鍵を入れ替えると、それまでに発行した `id_token` は検証できなくなります
（アクセストークンには影響しません）。
