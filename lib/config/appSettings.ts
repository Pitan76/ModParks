/**
 * アプリ設定 (App Settings)
 *
 * 値の実体は Cloudflare KV に単一キー (SETTINGS_KEY) の JSON として保存し、
 * 変更履歴は D1 の settings_audit テーブルに残します。
 *
 * KV は結果整合性 (最大 60 秒程度) のため、即時性が必須な設定は
 * ここではなく別の仕組みで扱ってください。
 */
import { z } from "zod";

/** KV 上の保存キー。設定はまとめて 1 キーに入れる（読み取り 1 回で済ませるため） */
export const SETTINGS_KEY = "app:settings";

export const appSettingsSchema = z.object({
  /** 一覧APIのデフォルト取得件数 */
  apiDefaultLimit: z.number().int().min(1).max(200).default(20),
  /** 一覧APIの最大取得件数 */
  apiMaxLimit: z.number().int().min(1).max(200).default(80),
  /** 新規ユーザー登録を受け付けるか */
  registrationEnabled: z.boolean().default(true),
  /**
   * cron による自動バックアップを行うか。
   * 既定は false。バックアップには認証情報が平文で含まれるため、
   * 内容の暗号化が入るまでは明示的に有効化した場合のみ動作させます。
   */
  autoBackupEnabled: z.boolean().default(false),
  /** 自動バックアップで残す世代数。これを超えた古いものから削除します */
  autoBackupKeepCount: z.number().int().min(1).max(90).default(14),
  /**
   * バックアップを Google Drive にも退避するか。
   * Cloudflare 側の障害やアカウント停止に備えた、事業者をまたぐ控えです。
   * サービスアカウントのシークレットが未設定の場合は有効にしても動作しません。
   */
  driveBackupEnabled: z.boolean().default(false),
  /**
   * 送信元メールアドレス。
   * Resend 側で検証済みのドメインでないと送信に失敗するため、変更時は注意すること。
   */
  mailFromAddress: z.email().default("no-reply@modparks.pitan76.net"),
  /** 送信元の表示名。空にするとアドレスのみで送信します */
  mailFromName: z.string().max(64).default("ModParks"),
  /** ブロックするメールアドレスドメイン */
  blockedEmailDomains: z.string().default(""),
  ddosThresholdRequests: z.number().int().default(1000),
  ddosThresholdDownloadRatio: z.number().default(0.8),
  ddosThresholdTopSlugRatio: z.number().default(0.75),
  ddosThresholdIpRepeatRate: z.number().default(5.0),
  ddosDefaultProtectionDuration: z.number().int().default(600000),

  // ---- クリエイタ還元 ----
  /** 還元機能全体の有効化。false の間は計算も分配も出金も行わない */
  creatorRewardEnabled: z.boolean().default(false),
  /** 新規ユーザーが既定で還元に参加するか */
  rewardOptInByDefault: z.boolean().default(false),
  /** 広告収益の還元率 */
  rewardPayoutRatioAds: z.number().min(0).max(1).default(0.5),
  /** 購読収益の還元率 */
  rewardPayoutRatioSub: z.number().min(0).max(1).default(0.7),
  /** 純利益のうち準備金として積み立てる割合。収益変動と事後減額を吸収する */
  rewardReserveRatio: z.number().min(0).max(1).default(0.2),
  /** 準備金がこれを下回ったら還元計算を自動停止する */
  rewardReserveFloorMinor: z.number().int().min(0).default(0),
  /** 月次プールの絶対上限。0 で無制限 */
  rewardMonthlyCapMinor: z.number().int().min(0).default(0),
  /** スコア算出時のページビューの重み */
  rewardWeightView: z.number().int().min(0).default(1),
  /** スコア算出時のダウンロードの重み */
  rewardWeightDownload: z.number().int().min(0).default(5),
  /** 1プロジェクトが取れるスコアシェアの上限（万分率）。超過分は他へ再配分する */
  rewardMaxProjectShareBps: z.number().int().min(100).max(10000).default(2000),
  /** これ未満の配分は付与せず翌期へ繰り越す */
  rewardMinPayoutPoints: z.number().int().min(1).default(1),

  // ---- 出金 ----
  /** 出金申請の最低ポイント。手数料が相対的に大きくならない水準に置く */
  payoutMinPoints: z.number().int().min(1).default(1000),
  /** これを超える出金は自動送金せず手動処理に回す */
  payoutAutoLimitPoints: z.number().int().min(0).default(5000),
  payoutPaypalEnabled: z.boolean().default(false),
  payoutGiftcardEnabled: z.boolean().default(false),
  /** 1pt をギフトカード額面いくらに交換するか。券種の手数料を吸収する */
  payoutGiftcardRate: z.number().min(0).max(1).default(1.0),
});

/** `"名前 <address>"` 形式の From ヘッダを組み立てる */
export function formatMailFrom(settings: Pick<AppSettings, "mailFromAddress" | "mailFromName">): string {
  const name = settings.mailFromName.trim();
  return name ? `${name} <${settings.mailFromAddress}>` : settings.mailFromAddress;
}

export type AppSettings = z.infer<typeof appSettingsSchema>;

/** スキーマ既定値のみで構成した設定 */
export const DEFAULT_APP_SETTINGS: AppSettings = appSettingsSchema.parse({});

/** 管理画面のどのタブに出すか */
export type AppSettingGroup = "general" | "ddos" | "reward";

/** 管理画面のフォーム生成に使うメタ情報 */
export type AppSettingField = {
  key: keyof AppSettings;
  type: "number" | "boolean" | "string";
  /** 管理画面に表示するラベル（i18n キー） */
  labelKey: string;
  helpKey: string;
  /** 省略時は "general" */
  group?: AppSettingGroup;
};

export const APP_SETTING_FIELDS: AppSettingField[] = [
  { key: "apiDefaultLimit", type: "number", labelKey: "apiDefaultLimit", helpKey: "apiDefaultLimitHelp" },
  { key: "apiMaxLimit", type: "number", labelKey: "apiMaxLimit", helpKey: "apiMaxLimitHelp" },
  { key: "registrationEnabled", type: "boolean", labelKey: "registrationEnabled", helpKey: "registrationEnabledHelp" },
  { key: "autoBackupEnabled", type: "boolean", labelKey: "autoBackupEnabled", helpKey: "autoBackupEnabledHelp" },
  { key: "autoBackupKeepCount", type: "number", labelKey: "autoBackupKeepCount", helpKey: "autoBackupKeepCountHelp" },
  { key: "driveBackupEnabled", type: "boolean", labelKey: "driveBackupEnabled", helpKey: "driveBackupEnabledHelp" },
  { key: "mailFromAddress", type: "string", labelKey: "mailFromAddress", helpKey: "mailFromAddressHelp" },
  { key: "mailFromName", type: "string", labelKey: "mailFromName", helpKey: "mailFromNameHelp" },
  { key: "blockedEmailDomains", type: "string", labelKey: "blockedEmailDomains", helpKey: "blockedEmailDomainsHelp" },
  { key: "ddosThresholdRequests", type: "number", labelKey: "ddosThresholdRequests", helpKey: "ddosThresholdRequestsHelp", group: "ddos" },
  { key: "ddosThresholdDownloadRatio", type: "number", labelKey: "ddosThresholdDownloadRatio", helpKey: "ddosThresholdDownloadRatioHelp", group: "ddos" },
  { key: "ddosThresholdTopSlugRatio", type: "number", labelKey: "ddosThresholdTopSlugRatio", helpKey: "ddosThresholdTopSlugRatioHelp", group: "ddos" },
  { key: "ddosThresholdIpRepeatRate", type: "number", labelKey: "ddosThresholdIpRepeatRate", helpKey: "ddosThresholdIpRepeatRateHelp", group: "ddos" },
  { key: "ddosDefaultProtectionDuration", type: "number", labelKey: "ddosDefaultProtectionDuration", helpKey: "ddosDefaultProtectionDurationHelp", group: "ddos" },
  { key: "creatorRewardEnabled", type: "boolean", labelKey: "creatorRewardEnabled", helpKey: "creatorRewardEnabledHelp", group: "reward" },
  { key: "rewardOptInByDefault", type: "boolean", labelKey: "rewardOptInByDefault", helpKey: "rewardOptInByDefaultHelp", group: "reward" },
  { key: "rewardPayoutRatioAds", type: "number", labelKey: "rewardPayoutRatioAds", helpKey: "rewardPayoutRatioAdsHelp", group: "reward" },
  { key: "rewardPayoutRatioSub", type: "number", labelKey: "rewardPayoutRatioSub", helpKey: "rewardPayoutRatioSubHelp", group: "reward" },
  { key: "rewardReserveRatio", type: "number", labelKey: "rewardReserveRatio", helpKey: "rewardReserveRatioHelp", group: "reward" },
  { key: "rewardReserveFloorMinor", type: "number", labelKey: "rewardReserveFloorMinor", helpKey: "rewardReserveFloorMinorHelp", group: "reward" },
  { key: "rewardMonthlyCapMinor", type: "number", labelKey: "rewardMonthlyCapMinor", helpKey: "rewardMonthlyCapMinorHelp", group: "reward" },
  { key: "rewardWeightView", type: "number", labelKey: "rewardWeightView", helpKey: "rewardWeightViewHelp", group: "reward" },
  { key: "rewardWeightDownload", type: "number", labelKey: "rewardWeightDownload", helpKey: "rewardWeightDownloadHelp", group: "reward" },
  { key: "rewardMaxProjectShareBps", type: "number", labelKey: "rewardMaxProjectShareBps", helpKey: "rewardMaxProjectShareBpsHelp", group: "reward" },
  { key: "rewardMinPayoutPoints", type: "number", labelKey: "rewardMinPayoutPoints", helpKey: "rewardMinPayoutPointsHelp", group: "reward" },
  { key: "payoutMinPoints", type: "number", labelKey: "payoutMinPoints", helpKey: "payoutMinPointsHelp", group: "reward" },
  { key: "payoutAutoLimitPoints", type: "number", labelKey: "payoutAutoLimitPoints", helpKey: "payoutAutoLimitPointsHelp", group: "reward" },
  { key: "payoutPaypalEnabled", type: "boolean", labelKey: "payoutPaypalEnabled", helpKey: "payoutPaypalEnabledHelp", group: "reward" },
  { key: "payoutGiftcardEnabled", type: "boolean", labelKey: "payoutGiftcardEnabled", helpKey: "payoutGiftcardEnabledHelp", group: "reward" },
  { key: "payoutGiftcardRate", type: "number", labelKey: "payoutGiftcardRate", helpKey: "payoutGiftcardRateHelp", group: "reward" },
];

/** 指定グループのフィールドを取り出す */
export function getAppSettingFields(group: AppSettingGroup): AppSettingField[] {
  return APP_SETTING_FIELDS.filter((f) => (f.group ?? "general") === group);
}

/**
 * 保存済みの値をスキーマに通して正規化する。
 * 壊れた値・未知のキー・スキーマ追加分は既定値で埋めるため、
 * KV の内容が古くても安全に読み出せます。
 */
export function normalizeAppSettings(raw: unknown): AppSettings {
  const parsed = appSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // 一部のフィールドだけ壊れている場合に備え、フィールド単位でフォールバックする
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const field of APP_SETTING_FIELDS) {
    const single = appSettingsSchema.shape[field.key].safeParse(source[field.key]);
    merged[field.key] = single.success ? single.data : DEFAULT_APP_SETTINGS[field.key];
  }
  return appSettingsSchema.parse(merged);
}
