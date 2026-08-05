/**
 * 機能スイッチの定義。
 *
 * グローバルなモードだけでは粒度が粗く、バグ 1 つでサイト全体を止めることになる。
 * 影響範囲を最小にできるよう、コストの重い機能を個別に停止できるようにする。
 */

/**
 * 停止できる機能。
 * 追加時は lang の Admin.runtime.feature 配下にラベルを足すこと。
 */
export const RUNTIME_FEATURES = [
  /** バージョンのアップロード。CPU と R2 書き込みが重い */
  "upload",
  /** JAR 解析。1件あたりの CPU が最も重い。止めてもアップロードは継続できる */
  "jarAnalysis",
  /** ModParks 経由のダウンロード */
  "download",
  /** コメント投稿 */
  "comment",
] as const;

export type RuntimeFeature = (typeof RUNTIME_FEATURES)[number];

/** 機能ごとの停止状態と理由 */
export type FeatureState = {
  enabled: boolean;
  /** 停止理由。管理画面と利用者向けの説明に使う */
  reason?: string;
  /** 停止した時刻(ms) */
  disabledAt?: number;
};

export type RuntimeConfig = {
  features: Partial<Record<RuntimeFeature, FeatureState>>;
};

/** 何も設定されていない状態。全機能が有効 */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = { features: {} };

/**
 * 機能が有効か。
 * 未設定の機能は有効として扱う。スイッチを足した時点で止まらないようにするため。
 */
export function isFeatureEnabled(config: RuntimeConfig, feature: RuntimeFeature): boolean {
  return config.features[feature]?.enabled !== false;
}

/** 表示用に、全機能を明示的な状態へ正規化する */
export function normalizeFeatures(config: RuntimeConfig): Record<RuntimeFeature, FeatureState> {
  const result = {} as Record<RuntimeFeature, FeatureState>;
  for (const feature of RUNTIME_FEATURES) {
    result[feature] = config.features[feature] ?? { enabled: true };
  }
  return result;
}
