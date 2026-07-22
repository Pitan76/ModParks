/**
 * マージ復元のテーブル別ポリシー定義（草案）。
 *
 * 「全消し→再投入」の復元とは別に、現行DBを保持したままバックアップの内容を
 * 取り込む「マージ復元」で、テーブルごとにどう衝突を解決するかを定義します。
 *
 * ⚠ この分類は運用方針に依存する草案です。特に REVIEW マークの付いたテーブルは
 *    「そのデータが復活/上書きされて良いか」というプロダクト判断が必要です。
 */

export type MergeStrategy =
  /** 主キーが現行DBに無い行だけ INSERT。既存行には一切触れない */
  | "insert_missing"
  /** 主キー衝突時、updatedAt が新しい方を採用。無い行は INSERT */
  | "last_write_wins"
  /** マージ対象外。バックアップ側の値は完全に無視する */
  | "skip"
  /** 自動適用しない。差分を提示して管理者が個別に承認する */
  | "manual";

export interface TablePolicy {
  strategy: MergeStrategy;
  /** この分類にした理由 */
  reason: string;
  /**
   * 運用方針の確認が必要な論点。
   * ここが埋まっているテーブルは、実装前にレビューが必要です。
   */
  review?: string;
}

export const MERGE_POLICIES: Record<string, TablePolicy> = {
  // ---- 認証・資格情報 ----
  // 自動マージすると「消したはずのアクセス手段が復活する」ため、すべて手動。
  users: {
    strategy: "manual",
    reason: "パスワードハッシュ・ロール・2FA設定を含む。自動上書きは権限昇格や認証情報の巻き戻しに直結する",
    review: "updatedAt が無いため LWW が使えない。BAN/凍結したユーザーがバックアップから復活する経路にもなる",
  },
  account: {
    strategy: "manual",
    reason: "OAuth 連携情報。復活すると解除したはずの外部アカウントで再ログインできてしまう",
  },
  api_keys: {
    strategy: "manual",
    reason: "失効させた API キーが復活すると、無効化した認証情報が再び有効になる",
  },
  authenticator: {
    strategy: "manual",
    reason: "2FA の認証器登録。解除した端末が復活しうる",
  },

  // ---- 揮発データ ----
  // 短命かつ再生成可能。バックアップ対象からも外して良い候補。
  session: {
    strategy: "skip",
    reason: "ログインセッション。期限切れの復活は無意味かつ有害",
    review: "そもそもバックアップ対象から除外して良いか（現状は含まれている）",
  },
  verificationToken: {
    strategy: "skip",
    reason: "使い捨ての検証トークン。復活させる意味がない",
  },
  password_reset_tokens: {
    strategy: "skip",
    reason: "パスワードリセットトークン。復活は乗っ取り経路になりうる",
  },
  rate_limits: {
    strategy: "skip",
    reason: "レート制限カウンタ。expiresAt ベースで自然に再生成される",
  },

  // ---- ユーザー付随データ ----
  user_profiles: {
    strategy: "manual",
    reason: "username に UNIQUE 制約があり、機械的な上書きは衝突を起こす",
    review: "updatedAt が無く LWW 不可。改名済みユーザーの旧 username がバックアップ側に残っている場合の扱いが未定",
  },
  user_settings: {
    strategy: "manual",
    reason: "外部サービスの API キーや所有確認済みフラグを含む。巻き戻すと確認済み状態が失われる",
    review: "updatedAt が無く LWW 不可。curseforgeVerifiedAt など「確認済み」系は現行優先が安全か",
  },

  // ---- 本体コンテンツ（updatedAt あり → LWW 可能） ----
  projects: {
    strategy: "last_write_wins",
    reason: "updatedAt を持つ。編集内容の新しい方を採用するのが直感に合う",
    review: "バックアップ後に削除されたプロジェクトが復活する。削除済みを識別する手段が無い",
  },
  collections: {
    strategy: "last_write_wins",
    reason: "updatedAt を持つ",
  },
  ideas: {
    strategy: "last_write_wins",
    reason: "updatedAt を持つ",
  },
  idea_comments: {
    strategy: "last_write_wins",
    reason: "updatedAt を持つ（編集済みコメントに対応）",
    review: "削除されたコメントが復活する",
  },
  project_comments: {
    strategy: "last_write_wins",
    reason: "updatedAt を持つ（編集済みコメントに対応）",
    review: "削除されたコメントが復活する。モデレーションで消したものが戻る点は特に要検討",
  },

  // ---- バージョン（実質イミュータブル） ----
  versions: {
    strategy: "insert_missing",
    reason: "公開済みバージョンは基本的に改変されない。updatedAt も持たない",
    review: "versions は R2 上のファイル実体を参照する。行だけ復活してファイルが無い状態になりうる",
  },
  version_loaders: { strategy: "insert_missing", reason: "versions に従属する複合主キーの中間テーブル" },
  version_mc_versions: { strategy: "insert_missing", reason: "versions に従属する複合主キーの中間テーブル" },
  version_ideas: { strategy: "insert_missing", reason: "version と idea の関連付け" },

  // ---- マスタデータ ----
  tags: { strategy: "insert_missing", reason: "マスタ。不足分の補完のみで足りる" },
  platforms: { strategy: "insert_missing", reason: "マスタ。不足分の補完のみで足りる" },
  categories: { strategy: "insert_missing", reason: "マスタ。不足分の補完のみで足りる" },

  // ---- 関連付け（複合主キーの中間テーブル） ----
  project_categories: { strategy: "insert_missing", reason: "関連付けのみを持つ中間テーブル" },
  project_tags: { strategy: "insert_missing", reason: "関連付けのみを持つ中間テーブル" },
  project_dependencies: { strategy: "insert_missing", reason: "依存関係の宣言。上書きの必要がない" },
  collection_items: { strategy: "insert_missing", reason: "コレクションへの登録。追加のみで復元できる" },
  project_members: {
    strategy: "manual",
    reason: "role 列を持ち、権限に影響する。外したメンバーが復活すると権限が戻る",
  },

  // ---- ユーザー行動ログ（追記のみ） ----
  project_favorites: { strategy: "insert_missing", reason: "お気に入り登録。追記のみで自然に復元できる" },
  idea_likes: { strategy: "insert_missing", reason: "いいね。追記のみで自然に復元できる" },
  user_follows: { strategy: "insert_missing", reason: "フォロー関係。追記のみで自然に復元できる" },
  collection_follows: { strategy: "insert_missing", reason: "フォロー関係。追記のみで自然に復元できる" },
  project_subscriptions: { strategy: "insert_missing", reason: "購読設定。追記のみで自然に復元できる" },
  developer_subscriptions: { strategy: "insert_missing", reason: "購読設定。追記のみで自然に復元できる" },

  // ---- 運営データ ----
  reports: {
    strategy: "insert_missing",
    reason: "通報は追記型。既存行を上書きしない",
    review: "対応済みにした通報がバックアップ側では未対応。insert_missing なら既存の対応状態は保たれるが、削除済みの通報は復活する",
  },
  notifications: {
    strategy: "insert_missing",
    reason: "通知は追記型",
    review: "既読にした通知がバックアップ側では未読。insert_missing なら既存行は保たれるが、ユーザーが消した通知は復活する",
  },
};

/**
 * 現行スキーマに存在するがバックアップ対象になっていないテーブル。
 * マージ以前にバックアップ範囲の問題なので、別途対応が必要です。
 */
export const KNOWN_UNBACKED_TABLES = [
  // settings_audit: 設定変更の監査ログ。SCHEMA_TABLES に登録されておらず、
  // バックアップにも復元にも含まれていない。
  "settings_audit",
];
