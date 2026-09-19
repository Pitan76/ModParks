# modparks-api

公開 API を Next.js から切り離して処理する Worker。

## なぜ分けるのか

Free プランの CPU 上限は 1 リクエスト **10 ms**。OpenNext 経由だと、React を
一切使わない API 要求でも isolate 起動時に Next のバンドル全体の評価を負担する。
その固定費を丸ごと外すのが目的。

サイドカー（`workers/jar` など）と違い、この Worker は **公開ルートを持つ**。
Service Binding 経由にするとメイン Worker の isolate が起動してしまい、
目的そのものが失われるため。

## ルーティング

メイン Worker はカスタムドメインで公開されているが、**ルートパターンは
カスタムドメインより優先される**（[Cloudflare のドキュメント](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)）。
`wrangler.toml` の `[[routes]]` に挙げたパスだけがメインを経由せずここへ届く。

## 切り戻し

ハンドラ本体は `packages/core/src/api/**` にあり、**Next 側のルートハンドラと
同じ実装を共有している**。この Worker に問題が出たら `wrangler.toml` の
`[[routes]]` を外して再デプロイすれば、そのパスはメイン Worker（Next の
ルートハンドラ）へ戻る。実装が 2 つに分かれていないので挙動は変わらない。

## 対応済みのパス

| パス | 実装 |
| --- | --- |
| `GET /api/v2/projects` | `packages/core/src/api/v2/projects.ts` |

`[[routes]]` のパターンを広げるときは、対応する実装を必ず先に用意すること。
拾ったのに実装が無いパスは 501 を返す（404 にすると「エンドポイントが消えた」
ように見えて原因を追いにくいため）。

## バインディング

D1 / KV / R2 をメインと同じ名前で参照する。バインディングはハンドラの `env`
から取り出して core へ引数で渡す（core はアンビエントに環境へ触らない規約）。
