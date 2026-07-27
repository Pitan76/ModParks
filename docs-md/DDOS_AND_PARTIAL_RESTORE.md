# DDoS自動防御システムおよびデータベース部分復元機能 設計書

本ドキュメントでは、ModParksに実装されたDDoS自動防御システム（DDoS Auto-Defense System）およびデータベース部分復元機能（Database Partial Restore）の設計仕様、アーキテクチャ、および検証結果について詳しく解説します。

---

## 1. DDoS自動防御システム

### 1.1 アーキテクチャの概要
この防御システムは、ダウンロード用API（/api/download）へのリクエストを監視・検知し、CloudflareのRuleset WAF APIと連携して、悪意あるDDoSリクエストをリアルタイムに自動防御する仕組みです。

```text
リクエスト受信 (/api/download)
            │
            ▼
┌───────────────────────────────┐
│       worker-wrapper.js       │ ◄─── インメモリのローカル集計（10秒バケット）
└──────────────┬────────────────┘
               │ (送信しきい値: 30リクエスト または 5秒経過)
               ▼
┌───────────────────────────────┐
│        D1 データベース         │ ◄─── 全体集計判定: (リクエスト > 1000 & DL成功率 > 80% & スラッグ偏り > 75%)
└──────────────┬────────────────┘
               │ (D1の楽観的ロックを用いて NORMAL から ACTIVATING に遷移)
               ▼
┌───────────────────────────────┐
│   Cloudflare Rulesets API     │ ◄─── 特定のスラッグに対する Managed Challenge を有効化
└───────────────────────────┘
```

### 1.2 インメモリでのローカル集計 (worker-wrapper.js)
*   各アイソレートのインメモリ上で、10秒ごとのバケット単位でアクセス数を集計します。
*   D1データベースへの負荷を抑えるため、30リクエストごと、または前回の送信から5秒以上経過した場合にバックグラウンドで集計データをフラッシュします。
*   バケット遷移時のデータ保護: リクエストが次の10秒バケットに進む際、前のバケットに溜まっていた未送信の集計値は自動的にコピーされ、リセット前に ctx.waitUntil を用いて同期的にフラッシュされます。これにより、アクセスが途絶えた瞬間のデータ欠損を防ぎます。

### 1.3 状態管理とD1による楽観的ロック
*   すべてのアイソレートは、D1データベース内に保存されたメトリクスを随時集計・評価します。
*   状態遷移時（防御発動時）は、KVロック等を使用せず、以下のようなSQLによるアトミックな楽観的ロック制御を行います。
    ```sql
    UPDATE ddos_state
    SET current_state = 'ACTIVATING', updated_at = ?
    WHERE state_key = 'global' AND current_state = 'NORMAL'
    ```
*   このクエリで実際にレコードを更新できた1つのアイソレート（meta.changes === 1）のみが、Cloudflare Ruleset WAFへのPATCHリクエストを処理します。他のアイソレートは更新失敗を検知してAPI呼び出しを中止するため、APIレート制限エラーや重複設定を防ぐことができます。
*   ルールセットに設定するスラッグ名は、正規表現（/^[a-z0-9-]{1,64}$/）で厳格にホワイトリスト検証した上で適用されます。

### 1.4 クールダウンとCronによるリカバリ
*   Cloudflare APIの呼び出しに失敗した場合は、API枠を保護するために直ちに COOLDOWN（クールダウン）状態に遷移し、2分間処理を保留します。
*   定期実行されるCronジョブ（*/10 * * * *）が、30分以上経過した古い一時データを自動的にクリーンアップし、さらにCloudflareの現在の実際のWAF適用状況をGET APIで確認することで、ACTIVATING や DEACTIVATING で停止してしまったアイソレート状態を安全に自動リカバリします。

---

## 2. データベース部分復元機能

### 2.1 概要と目的
DDoS攻撃が発生すると、プロジェクトやバージョンのダウンロード数が急激に上昇し、統計データが大きく歪んでしまいます。これを修正するためにデータベース全体のバックアップから復元を行うと、バックアップ以降に登録されたユーザー情報、新規Mod、コメント、説明文などがすべて削除されてしまうという問題が生じます。

この問題を解決するため、必要なデータのみを柔軟に切り戻すことができる「部分復元（復元範囲指定）」機能を導入しました。

### 2.2 サポートする復元範囲（モード）
1.  データベース全体を復元 (Full Database Restore): 既存の全テーブルデータを削除し、バックアップ時点の内容で完全に置き換えます。
2.  ダウンロード数のみ復元 (Download Counts Only): 既存のデータを一切削除せず、バックアップに含まれるプロジェクトおよびバージョンのIDを基準に、ダウンロード数（downloads / total_downloads）の数値だけを安全に上書き更新します。
3.  一部のテーブルのみ削除して復元 (Selected Tables): 管理者が選択した特定のテーブルのみをクリアし、バックアップから復旧させます。

### 2.3 主要なコード設計

#### バックエンドロジック (lib/backup/backupImport.ts)
RestoreOptions 型を定義し、D1のクエリ上限数を超えないよう、実行ステートメントを100件単位に自動分割して実行します。
```typescript
export type RestoreOptions = {
  mode?: "all" | "downloads_only" | "selected_tables";
  selectedTables?: string[];
};
```

#### UIダイアログ (components/admin/RestoreBackupDialog.tsx)
復元モードの選択肢を配置し、「一部のテーブルのみ削除して復元」が選ばれた場合には、全41個のデータベーステーブルをチェックボックス付きのスクロール領域として表示します。
```tsx
// テーブルのグリッド選択 (mode === "selected_tables" のみ表示)
<Grid size={{ xs: 12, sm: 6, md: 4 }} key={tableName}>
  <FormControlLabel
    control={
      <Checkbox
        checked={selectedTables.includes(tableName)}
        onChange={() => handleTableToggle(tableName)}
      />
    }
    label={tableName}
  />
</Grid>
```

### 2.4 SQL実行プロセス（downloads_only 時の動作）
バックアップデータ内の各行を走査し、以下のようにIDが一致するレコードのみを更新するSQLを発行します。
```sql
UPDATE projects SET downloads = ?, total_downloads = ? WHERE id = ?;
UPDATE versions SET downloads = ? WHERE id = ?;
```
既存のレコードの削除は一切発生せず、他のカラム（説明文や作成日時など）も変更されません。

---

## 3. 動作検証とテスト結果

### 3.1 DDoS自動防御機能のテスト
1,500件の同時アクセスを発生させるシミュレーションを実行し、10秒ごとの境界におけるインメモリ集計値のフラッシュ、グローバルなIP重複レートの評価、状態マシンの排他ロック制御、およびCloudflare API接続失敗時のクールダウンフォールバックが正確に機能することを確認しました。

### 3.2 部分復元の整合性テスト
ローカルのD1 SQLiteデータベースファイルを用いて以下の実証実験を行いました。
1.  DDoS水増しの再現: 特定のプロジェクトのダウンロード数を 99999 に更新。
    ```json
    { id: 'w2xu7jcfltteo4y0s233kk0l', name: 'Simple Cables', downloads: 99999, total_downloads: 99999 }
    ```
2.  部分復元の実行: downloads_only モードでアップデートを実行。
    ```sql
    UPDATE projects SET downloads = 2, total_downloads = 2 WHERE id = 'w2xu7jcfltteo4y0s233kk0l'
    ```
3.  結果確認: 対象プロジェクト of ダウンロード数が元の正しい数値（2）に安全にロールバックされ、プロジェクトの名前や説明文（description）は一切変更されず保護されていることを確認しました。
    ```text
    SUCCESS: Download counts restored to backup value, and description remained untouched!
    ```
