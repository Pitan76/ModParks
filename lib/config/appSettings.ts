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
});

/** `"名前 <address>"` 形式の From ヘッダを組み立てる */
export function formatMailFrom(settings: Pick<AppSettings, "mailFromAddress" | "mailFromName">): string {
  const name = settings.mailFromName.trim();
  return name ? `${name} <${settings.mailFromAddress}>` : settings.mailFromAddress;
}

export type AppSettings = z.infer<typeof appSettingsSchema>;

/** スキーマ既定値のみで構成した設定 */
export const DEFAULT_APP_SETTINGS: AppSettings = appSettingsSchema.parse({});

/** 管理画面のフォーム生成に使うメタ情報 */
export type AppSettingField = {
  key: keyof AppSettings;
  type: "number" | "boolean" | "string";
  /** 管理画面に表示するラベル（i18n キー） */
  labelKey: string;
  helpKey: string;
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
];

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
