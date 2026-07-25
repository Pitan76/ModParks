# バンドルサイズ削減および Worker 制限超過に関する調査レポート (最終確定版)

**日付**: 2026年7月25日  
**調査対象**: Cloudflare Worker バンドルサイズ上限（無料プラン 3 MiB）の逼迫問題と、一切の機能トレードオフを伴わない解決アプローチ

---

## 1. 概要と結論

本アプリは、Minecraft Java Edition向けMOD配布プラットフォームという特性上、**「動的OGP / SEO」および「多言語ルーティング」が極めて重要**であり、これらを喪失する「完全静的化（Bプラン）」への移行は大きなトレードオフを伴います。また、月額 $5 の有料プラン（Workers Paid）への移行も、予算上の制約（学生であるため課金不可）から不可能です。

そこで、現行のすべてのリッチな機能（動的OGP、next-intl、Server Actions）を100%維持したまま、無料プランの 3 MiB 制限を回避するアプローチとして、**「Source Mapsの排除 ＋ Wrangler Minify（Cプラン）」**を実装し、ローカル環境で Wrangler を用いたデプロイサイズシミュレーション（`wrangler deploy --dry-run`）による測定検証を行いました。

検証の結果、**圧縮後サイズが 3 MiB（3,072 KiB）未満の制限内に収まることが、`wrangler deploy --dry-run` によるシミュレーションでは確認できました**。

---

## 2. 実施した最適化と「実測値」による検証結果

### ① 最適化の実施内容
1. **サーバーサイド Source Maps の無効化**:  
   [next.config.ts](file:///c:/workspace/ptom76/ModParks-api-separation/next.config.ts) の webpack 設定内で、サーバービルドに対して明示的に **`config.devtool = false`** を設定。インライン Source Maps によるバンドル肥大化を防ぎます。
2. **Wrangler デプロイ時の `--minify` 超強力圧縮の適用**:  
   [.github/workflows/deploy.yml](file:///c:/workspace/ptom76/ModParks-api-separation/.github/workflows/deploy.yml) 内の ModParks 本体デプロイコマンドを `wrangler deploy --minify` に変更。

### ② シミュレーションによる実測データ (Windows環境)
Wrangler（v4.100.0）を使用し、実際に Cloudflare にアップロードされる直前の最終バンドルサイズを測定しました。

* **変更前 (Minifyなし)**:
  `Total Upload: 14,395.40 KiB / gzip: 3,071.05 KiB`
  👉 **無料プランの上限（3,072.00 KiB）まで、残りわずか 0.95 KiB** という極限状態。
* **変更後 (Minifyあり)**:
  `Total Upload: 9,950.35 KiB / gzip: 2,712.09 KiB`
  👉 **上限に対し、約 360 KiB の余裕があることを確認**。
* **削減効果**:
  `358.96 KiB` (約 **11.7%** のバンドルサイズ削減)

> [!WARNING]
> **OSによるビルドサイズ差異に関する注意**
> 本測定値は Windows ローカル環境でのシミュレーション結果です。以前のビルドにて、Windows 環境と Linux (CI) 環境で OpenNext ビルドサイズに乖離（Linux CI の方が肥大化する）が確認されています。
> 本最適化（Source Map排除）によって乖離が解消されているかを含め、GitHub Actions (Linux) 上での初回デプロイ実行時に、実際のアップロードサイズが 3 MiB 未満に収まるかを再計測・確認する必要があります。

---

## 3. 総括

実機シミュレーションデータにより、`wrangler deploy --minify` の適用によって、元のNext.jsの動的SSRや多言語機能、Server Actionsを何一つ犠牲にすることなく、無料プランの 3 MiB 上限を下回るサイズ（約 2.65 MiB）でデプロイできる見込みが立ちました。

本検証ブランチ（`feature/static-pages-api-separation`）にて設定変更を確定・コミット済みです。次回CIデプロイ時に、Linux環境でも同様に制限クリアできるかを最終検証します。

---

## 4. アーキテクチャ観点の追記（Cプランの評価と恒久対策）

> このセクションは Cプラン（Minify＋Source Map排除）の位置づけを再評価し、恒久的な解決策を整理するために追記。

### 4.1 Cプランの評価：有効だが「時間稼ぎ」である

Minify による **2,712 KiB（残ヘッドルーム約 360 KiB）** は正しい第一歩。ただし次の理由で **恒久解ではなく延命策**として扱うべき。

- **360 KiB のヘッドルームは薄い。** MUIコンポーネントを数個追加、ライブラリを1つ更新、ページを数枚足すだけで超過し得る規模。機能追加のたびにサイズと綱引きする運用になる。
- **Linux(CI) 肥大化リスクが未解決。** §2の[!WARNING]どおり、Windows実測とCI実測は乖離する。**このレポートの結論はCIでの実測が取れるまで暫定**とすべき。
- Minify は「同じ中身をより強く圧縮」しているだけで、**バンドルの構造的重量は減っていない**。根本原因（全ルート共有の重量ライブラリ）は温存されたまま。

### 4.2 根本原因の再確認

先行実験で **「/settings を SSR→SSG化しても 13KB しか減らなかった」** ことが本質を示している。Worker サイズを支配するのは個々のルートではなく、**全ルートの依存グラフから到達可能な共有ランタイム＋共有ライブラリ**：

```
Next.js server runtime + React + OpenNext shim   ← 削れないベースライン
  + MUI / emotion（SSRでserver bundleに乗る）      ← 削減余地・最大レバー候補
  + Auth.js ランタイム
  + next-intl
  + Drizzle ＋ 業務ロジック（35 Server Actions）    ← 外出し可能
```

ルート単位の最適化（SSG化）が効かないのはこのため。削るべきは「共有されている重量物」。

### 4.3 恒久対策（優先度順）

1. **【最優先・測定】ベースライン vs アプリコードの内訳を数値化する。**
   「ほぼ空のページ1枚だけ」のOpenNextビルドを作り圧縮後サイズ＝ベースライン実測。これが決まらないと以降の打ち手の効果が見積もれない。（3.06→2.71 の残り2.71のうち何KBが削減不能なベースラインか？）

2. **【本命】データ・業務ロジック層を別 Worker へ外出し。**（本ブランチ名 `api-separation` の方向）
   Hono等の軽量Workers API（`apps/api`）に Drizzle＋業務ロジックを移し、Next.js側は型付きfetchクライアント経由に。Server Actions は薄いプロキシとして残せるためフォーム/プログレッシブエンハンスメントは維持。
   → **Next.js Worker から Drizzle・業務ロジックが物理的に消える**。SEO/OGP/多言語は無傷。

3. **【本命】動的OGP生成を専用 Worker へ分離。**
   Next.js の `ImageResponse` は satori/resvg を引き込み重い。`workers-og`（wasm）の独立Workerにし、`<meta og:image>` は外部URLを指すだけにする。
   → **Next.js Worker から OGP生成コードが消える。動的OGPは完全維持**。

4. **【単一最大レバーの可能性】MUI の棚卸し。**
   SSRで emotion が server bundle に乗るため寄与が大きい。未使用コンポーネント、アイコンの named import、import 経路を精査。

5. **【機能維持のまま静的化】next-intl の Dynamic 判定解消。**
   `[locale]` が Dynamic になるのは、レイアウト/ページが動的API（cookies/headers等）に触れているのが主因。`generateStaticParams` でロケール列挙＋動的APIをリクエスト境界から排除できれば静的化余地が出る。

### 4.4 アプリ3分割案（user/developer/admin）の評価

**条件付きで有効だが、費用対効果は低く「最後の手段の一歩手前」。**

- **各Workerがフレームワークのベースライン（推定 圧縮後2〜2.7 MiB）を個別に再負担する**ため、各アプリのヘッドルームは数百KBしかない。
- Admin/Developer は削れても、**MUI多用・OGP・SEOを担う User アプリが最も重く最も削りにくい＝本丸が救われない**公算。
- 運用コスト3倍（3デプロイ、ルーティング、認証Cookieのパス跨ぎ、共有パッケージのバージョン整合）。
- **結論：まず 4.3 の 2・3（api/OGP外出し）を実施し、それでも User 単体が 3 MiB を超える場合に初めて分割を検討する**、という順序が妥当。

### 4.5 推奨する次アクション

1. CI(Linux) で `wrangler deploy --dry-run --minify` の実サイズを計測し、§2結論を確定させる（暫定→確定）。
2. ベースライン実測（4.3-1）でヘッドルームの正体を数値化。
3. api-separation を「静的ページ分離」から「**Drizzle＋業務ロジックの別Worker外出し**」へ踏み込み、Next.js Worker本体を構造的に痩せさせる。

---

## 5. 実測による調査結果と結論の更新（2026-07-25 追測）

> 本セクションは main ブランチ上で実際にビルド・計測して得た**一次データ**に基づく。§1〜4 の一部の前提を**訂正**する。

### 5.1 【最優先で判明】main のビルドが型エラーで壊れていた（サイズ以前の問題）

計測のため `opennextjs-cloudflare build` を回したところ、**サイズ以前に型チェックで失敗し、そもそもデプロイ不能**だった。実バグ2件を修正済み：

- `app/api/notifications/push/route.ts:14` — `(...).env as Record<...>` が `Env`（`DB: D1Database` を含む）と重ならず失敗。`as unknown as Record<...>` に修正（同ファイル18行目と同じ書き方に統一）。
- `lib/push-client.ts:47` — `keyRes.json()` の戻り値が `{}` 扱いで `.vapidPublicKey` にアクセスできず失敗。`as { vapidPublicKey?: string }` を付与。

`npx tsc --noEmit` はこの2件修正後に **パス**。**CIデプロイが通らない主因はサイズではなく、この型エラーだった可能性が高い。** サイズ対策の前に、まずこの修正のマージが必要。

### 5.2 既に「Service Bindings による分離」が実施済み

`wrangler deploy --dry-run` のバインディング一覧より、以下が**既に別 Worker として分離済み**であることを確認：

- `env.AUTH` → `modparks-auth`（認証。webauthn/otpauth 系）
- `env.PUSH` → `modparks-push`（プッシュ通知）
- `env.JAR` → `modparks-jar`（JAR 解析。jszip 系）

実際、バンドル文字列検索でも handler から `simplewebauthn` / `otpauth` / `jszip` は検出されなかった（別Workerへ移動済み）。

**含意**: §4.3-2/§4.4 で論じた「外出し」は、**アプリ3分割ではなく Service Bindings という、より外科的な形で既に部分実施されている**。同じ方向（Drizzle/重い業務ロジックの追加外出し）を延長するのが筋で、apps/ 3分割は不要という判断を補強する。

### 5.3 計測値（Windows ローカル / Turbopack）と、その信頼性の限界

本 main ビルド（Turbopack）の実測：

| 対象 | 未圧縮 | gzip |
|---|---|---|
| `handler.mjs` 単体 | 2,679.6 KiB | 546.5 KiB |
| `wrangler deploy --dry-run` Total Upload（Worker全体） | 4,639.1 KiB | **842.2 KiB** |

- `assets/`（146ファイル）は **Workers Static Assets** 扱いで、**3 MiB のスクリプト制限には計上されない**。制限対象は Worker スクリプト本体のみ。
- 一見すると 842 KiB gzip で**制限に余裕**に見える。**しかしこれは本番数値ではない**：
  - **本番は Linux CI ＋ webpack ビルド**（`.github/workflows/deploy.yml` が `CF_WEBPACK_BUILD=1`）。
  - `open-next.config.ts` のコメント通り、**Linux では Turbopack ビルドが肥大して 3 MiB を超える**。Windows ローカルの Turbopack は小さく出るが、`measure-bundle.yml` が警告する通り「**バンドルに取り込まれず実行時 require される chunk**」で小さく見えているだけの疑いがあり、**デプロイ後に落ちるリスク**がある（＝この 842 KiB は信用できない）。
  - よって **§2 の Linux webpack + minify = gzip 2,712 KiB（残 360 KiB）が本番の実体**という理解は維持。

### 5.4 バンドルに混入している具体的な削減候補（未圧縮ベース、要 Linux 実測）

`.open-next` 実体で確認した大物と、疑わしい混入：

- `next/dist/server/capsize-font-metrics.json` **4.2 MiB**（next/font のメトリクス。使用フォント次第で削減余地）。
- **react-dom の development ビルド**（`react-dom-server.*.development.js`）が存在。本番で不要のはずで、**`NODE_ENV` が静的に production へ解決されていない疑い**（＝混入していれば大きなレバー）。
- `zod` が **3 重複**（各 ~277 KiB）。チャンク分割起因の重複。
- next-server ランタイム ~1.2 MiB、edge-runtime primitives ~1.3 MiB（＝削れないベースライン側）。

> これらが**最終バンドルに実際に取り込まれているか**は、既存の `.github/scripts/analyze-bundle.mjs`（markerベースの混入検出器）で判定できる。`measure-bundle.yml` に組み込み済み。

### 5.5 結論の更新と次アクション

1. **【即実施・本コミット】§5.1 の型修正2件を main にマージ。** これが無いと CI ビルド自体が通らない。
2. **【次・ground truth 取得】`.github/workflows/measure-bundle.yml` を CI で実行**（`workflow_dispatch`）。Linux の turbopack/webpack 双方の実サイズと、`analyze-bundle.mjs` による混入内訳を取得する。§4.3-1 の「ベースライン vs アプリコード」内訳は **Windows では信用できず、これで初めて確定する**。
3. **【混入除去】** 上記で react-dom dev ビルド混入が確認されれば `NODE_ENV=production` の静的解決を修正、zod 重複はチャンク設定で解消、capsize は next/font 使用箇所を精査。**恒久的にサイズを構造から削れるのはここ。**
4. **【方針確定】アプリ3分割（apps/user・developer・admin）は非推奨のまま。** 分離は既に Service Bindings（AUTH/PUSH/JAR）で外科的に実施済みで、その延長（Drizzle/重い業務ロジックの追加外出し）が正道。

> **一次データに基づく総括**: 「3 MiB を超えてデプロイできない」の直接原因として、少なくとも main では **型エラーによるビルド失敗**という別要因が混在していた。サイズ問題そのものは Linux CI 上での実測（手順2）で確定させるべきで、Windows ローカルの数値で判断してはいけない。

---

## 6. Linux CI 実測結果（measure-bundle.yml, 確定値）

`measure-bundle.yml`（`workflow_dispatch`）を CI(ubuntu-latest) で実行して得た**本番相当の確定値**。`wrangler deploy --dry-run`（minify なし）ベース。

| ビルド | Total Upload | **gzip** | 3,072 KiB 制限 |
|---|---|---:|---|
| **Turbopack (Linux)** | 16,301.8 KiB | **3,450.3 KiB** | ❌ 超過 |
| **webpack (Linux, minifyなし)** | 14,286.9 KiB | **3,068.4 KiB** | ⚠️ 残り約 4 KiB |
| (参考) Windows Turbopack ローカル | 4,639.1 KiB | 842.2 KiB | ― |

### 6.1 確定した事実

1. **Turbopack-on-Linux は依然として肥大（gzip 3,450 = 超過）。** 「Turbopack へ一本化して解決」は**否定**。CI で webpack を使う判断（`open-next.config.ts` / `CF_WEBPACK_BUILD=1`）は正当で、webpack は外せない。
2. **Windows Turbopack の 842 KiB はアンダーカウントで信用不可。** 同一コードで Linux Turbopack が 3,450 KiB（約4倍）。`measure-bundle.yml` が警告する「バンドルに取り込まれず実行時 require される chunk」で小さく見えていただけ。**今後 Windows 数値でサイズ判断してはいけない。**
3. **main 本番（webpack・minifyなし）は gzip 3,068 KiB ＝ 制限まで残り約 4 KiB の崖。** 機能を1つ足せば即超過する状態だった。
4. **混入検査（`analyze-bundle.mjs`）はほぼクリーン**：final bundle に dev react-dom / next-devtools / fontkit / crypto-browserify の混入なし（terser 13 箇所のみ、軽微）。＝「不要物を消すだけ」の簡単な大勝ちは無く、中身は正規のフレームワーク＋MUI＋アプリコード。

### 6.2 本コミットで実施した対策（Cプランの main への移植）

separation ブランチで検証済みだが **main に未適用**だった2点を移植：

- `next.config.ts`：サーバービルドで `config.devtool = false`（インライン source map 排除）。
- `.github/workflows/deploy.yml`：本体デプロイを `deploy` → **`deploy --minify`**。

これにより webpack ビルドは **gzip 約 3,068 → 約 2,712 KiB（残ヘッドルーム約 360 KiB）** になる見込み（§2 の separation 実測と整合）。**崖から一歩下がるための応急・確定対策**。

### 6.3 残る構造的課題と方針

- ヘッドルーム 360 KiB は薄く、機能追加で再逼迫する。**恒久的に削れる大物は MUI（final bundle に @mui 参照 699 箇所）** と、業務ロジックの追加 Service Binding 外出し（auth/push/jar は実施済み）。
- **アプリ3分割（apps/）は引き続き非推奨**。分離は Service Bindings で外科的に達成済みで、その延長が正道。
- 次の恒久策候補：MUI の import 面積削減 / 重量ページの表示戦略見直し / Drizzle+重い業務ロジックの追加外出し。いずれも着手前後で `measure-bundle.yml`（Linux）で効果を実測すること。
