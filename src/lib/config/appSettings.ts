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

  // ---- 利用量と予算 ----
  /**
   * 契約プラン。超過時の結果が正反対のため、判定の期間と意味を切り替える。
   * free は日次リセットで超えると停止、paid は月次で超えると課金。
   */
  usagePlan: z.enum(["free", "paid"]).default("free"),
  /**
   * リクエスト数の含有枠。free なら1日あたり、paid なら1か月あたり。
   * 実値は変動するため、料金ページを見て管理画面から更新する。
   */
  usageQuotaRequests: z.number().int().min(0).default(100000),
  /** D1 の書き込み行数の含有枠。0 なら評価しない */
  usageQuotaD1RowsWritten: z.number().int().min(0).default(0),
  /** D1 の読み取り行数の含有枠。0 なら評価しない */
  usageQuotaD1RowsRead: z.number().int().min(0).default(0),
  /**
   * paid で許容する月あたりの追加課金額(円)。
   * 0 にすると数円の超過でも警告が鳴り続けるため、無視してよい額を既定にする。
   */
  usageBudgetJpy: z.number().int().min(0).default(100),
  /** 含有枠と単価を最後に確認した日 (epoch day)。古くなったら管理画面で促す */
  usageQuotaCheckedDay: z.number().int().min(0).default(0),

  // ---- AI 翻訳 ----
  /** 説明文の AI 翻訳を行うか。false の間は閲覧者にも作者にも翻訳の導線を出さない */
  translationEnabled: z.boolean().default(true),
  /** 使用するモデル。プロバイダを差し替えたときは合わせて変えること */
  translationModel: z.string().min(1).default("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  /**
   * 1 回の呼び出しで生成させる上限トークン。
   * 小さすぎると応答が途中で切れ、その塊が原文のまま残る。
   */
  translationMaxTokens: z.number().int().min(256).max(8192).default(1024),
  /**
   * 1 回の呼び出しに載せる本文の文字数。
   * 小さいほど書式は安定し 1 回の生成量も減るが、呼び出し回数は増える。
   */
  translationChunkChars: z.number().int().min(200).max(4000).default(800),
  /** 1 プロジェクトあたりの翻訳対象の上限文字数。超えると手動翻訳へ誘導する */
  translationMaxInputChars: z.number().int().min(1000).max(100000).default(10000),
  /** サイト全体の 1 日あたりの実行回数。無料枠に収めるための上限 */
  translationDailyRunLimit: z.number().int().min(0).max(100000).default(50),
  /** 1 ユーザーあたりの 1 時間の実行回数 */
  translationUserHourlyLimit: z.number().int().min(1).max(1000).default(20),

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
export type AppSettingGroup = "general" | "ddos" | "reward" | "translation";

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
  { key: "translationEnabled", type: "boolean", labelKey: "translationEnabled", helpKey: "translationEnabledHelp", group: "translation" },
  { key: "translationModel", type: "string", labelKey: "translationModel", helpKey: "translationModelHelp", group: "translation" },
  { key: "translationMaxTokens", type: "number", labelKey: "translationMaxTokens", helpKey: "translationMaxTokensHelp", group: "translation" },
  { key: "translationChunkChars", type: "number", labelKey: "translationChunkChars", helpKey: "translationChunkCharsHelp", group: "translation" },
  { key: "translationMaxInputChars", type: "number", labelKey: "translationMaxInputChars", helpKey: "translationMaxInputCharsHelp", group: "translation" },
  { key: "translationDailyRunLimit", type: "number", labelKey: "translationDailyRunLimit", helpKey: "translationDailyRunLimitHelp", group: "translation" },
  { key: "translationUserHourlyLimit", type: "number", labelKey: "translationUserHourlyLimit", helpKey: "translationUserHourlyLimitHelp", group: "translation" },
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
