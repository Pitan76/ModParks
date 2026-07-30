/**
 * 繧｢繝励Μ險ｭ螳・(App Settings)
 *
 * 蛟､縺ｮ螳滉ｽ薙・ Cloudflare KV 縺ｫ蜊倅ｸ繧ｭ繝ｼ (SETTINGS_KEY) 縺ｮ JSON 縺ｨ縺励※菫晏ｭ倥＠縲・
 * 螟画峩螻･豁ｴ縺ｯ D1 縺ｮ settings_audit 繝・・繝悶Ν縺ｫ谿九＠縺ｾ縺吶・
 *
 * KV 縺ｯ邨先棡謨ｴ蜷域ｧ (譛螟ｧ 60 遘堤ｨ句ｺｦ) 縺ｮ縺溘ａ縲∝叉譎よｧ縺悟ｿ・医↑險ｭ螳壹・
 * 縺薙％縺ｧ縺ｯ縺ｪ縺丞挨縺ｮ莉慕ｵ・∩縺ｧ謇ｱ縺｣縺ｦ縺上□縺輔＞縲・
 */
import { z } from "zod";

/** KV 荳翫・菫晏ｭ倥く繝ｼ縲りｨｭ螳壹・縺ｾ縺ｨ繧√※ 1 繧ｭ繝ｼ縺ｫ蜈･繧後ｋ・郁ｪｭ縺ｿ蜿悶ｊ 1 蝗槭〒貂医∪縺帙ｋ縺溘ａ・・*/
export const SETTINGS_KEY = "app:settings";

export const appSettingsSchema = z.object({
  /** 荳隕ｧAPI縺ｮ繝・ヵ繧ｩ繝ｫ繝亥叙蠕嶺ｻｶ謨ｰ */
  apiDefaultLimit: z.number().int().min(1).max(200).default(20),
  /** 荳隕ｧAPI縺ｮ譛螟ｧ蜿門ｾ嶺ｻｶ謨ｰ */
  apiMaxLimit: z.number().int().min(1).max(200).default(80),
  /** 譁ｰ隕上Θ繝ｼ繧ｶ繝ｼ逋ｻ骭ｲ繧貞女縺台ｻ倥￠繧九° */
  registrationEnabled: z.boolean().default(true),
  /**
   * cron 縺ｫ繧医ｋ閾ｪ蜍輔ヰ繝・け繧｢繝・・繧定｡後≧縺九・
   * 譌｢螳壹・ false縲ゅヰ繝・け繧｢繝・・縺ｫ縺ｯ隱崎ｨｼ諠・ｱ縺悟ｹｳ譁・〒蜷ｫ縺ｾ繧後ｋ縺溘ａ縲・
   * 蜀・ｮｹ縺ｮ證怜捷蛹悶′蜈･繧九∪縺ｧ縺ｯ譏守､ｺ逧・↓譛牙柑蛹悶＠縺溷ｴ蜷医・縺ｿ蜍穂ｽ懊＆縺帙∪縺吶・
   */
  autoBackupEnabled: z.boolean().default(false),
  /** 閾ｪ蜍輔ヰ繝・け繧｢繝・・縺ｧ谿九☆荳紋ｻ｣謨ｰ縲ゅ％繧後ｒ雜・∴縺溷商縺・ｂ縺ｮ縺九ｉ蜑企勁縺励∪縺・*/
  autoBackupKeepCount: z.number().int().min(1).max(90).default(14),
  /**
   * 繝舌ャ繧ｯ繧｢繝・・繧・Google Drive 縺ｫ繧る驕ｿ縺吶ｋ縺九・
   * Cloudflare 蛛ｴ縺ｮ髫懷ｮｳ繧・い繧ｫ繧ｦ繝ｳ繝亥●豁｢縺ｫ蛯吶∴縺溘∽ｺ区･ｭ閠・ｒ縺ｾ縺溘＄謗ｧ縺医〒縺吶・
   * 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医・繧ｷ繝ｼ繧ｯ繝ｬ繝・ヨ縺梧悴險ｭ螳壹・蝣ｴ蜷医・譛牙柑縺ｫ縺励※繧ょ虚菴懊＠縺ｾ縺帙ｓ縲・
   */
  driveBackupEnabled: z.boolean().default(false),
  /**
   * 騾∽ｿ｡蜈・Γ繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縲・
   * Resend 蛛ｴ縺ｧ讀懆ｨｼ貂医∩縺ｮ繝峨Γ繧､繝ｳ縺ｧ縺ｪ縺・→騾∽ｿ｡縺ｫ螟ｱ謨励☆繧九◆繧√∝､画峩譎ゅ・豕ｨ諢上☆繧九％縺ｨ縲・
   */
  mailFromAddress: z.email().default("no-reply@modparks.pitan76.net"),
  /** 騾∽ｿ｡蜈・・陦ｨ遉ｺ蜷阪らｩｺ縺ｫ縺吶ｋ縺ｨ繧｢繝峨Ξ繧ｹ縺ｮ縺ｿ縺ｧ騾∽ｿ｡縺励∪縺・*/
  mailFromName: z.string().max(64).default("ModParks"),
  /** 繝悶Ο繝・け縺吶ｋ繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繝峨Γ繧､繝ｳ */
  blockedEmailDomains: z.string().default(""),
  ddosThresholdRequests: z.number().int().default(1000),
  ddosThresholdDownloadRatio: z.number().default(0.8),
  ddosThresholdTopSlugRatio: z.number().default(0.75),
  ddosThresholdIpRepeatRate: z.number().default(5.0),
  ddosDefaultProtectionDuration: z.number().int().default(600000),

  // ---- 繧ｯ繝ｪ繧ｨ繧､繧ｿ驍・・ ----
  /** 驍・・讖溯・蜈ｨ菴薙・譛牙柑蛹悶Ｇalse 縺ｮ髢薙・險育ｮ励ｂ蛻・・繧ょ・驥代ｂ陦後ｏ縺ｪ縺・*/
  creatorRewardEnabled: z.boolean().default(false),
  /** 譁ｰ隕上Θ繝ｼ繧ｶ繝ｼ縺梧里螳壹〒驍・・縺ｫ蜿ょ刈縺吶ｋ縺・*/
  rewardOptInByDefault: z.boolean().default(false),
  /** 蠎・相蜿守寢縺ｮ驍・・邇・*/
  rewardPayoutRatioAds: z.number().min(0).max(1).default(0.5),
  /** 雉ｼ隱ｭ蜿守寢縺ｮ驍・・邇・*/
  rewardPayoutRatioSub: z.number().min(0).max(1).default(0.7),
  /** 邏泌茜逶翫・縺・■貅門ｙ驥代→縺励※遨阪∩遶九※繧句牡蜷医ょ庶逶雁､牙虚縺ｨ莠句ｾ梧ｸ幃｡阪ｒ蜷ｸ蜿弱☆繧・*/
  rewardReserveRatio: z.number().min(0).max(1).default(0.2),
  /** 貅門ｙ驥代′縺薙ｌ繧剃ｸ句屓縺｣縺溘ｉ驍・・險育ｮ励ｒ閾ｪ蜍募●豁｢縺吶ｋ */
  rewardReserveFloorMinor: z.number().int().min(0).default(0),
  /** 譛域ｬ｡繝励・繝ｫ縺ｮ邨ｶ蟇ｾ荳企剞縲・ 縺ｧ辟｡蛻ｶ髯・*/
  rewardMonthlyCapMinor: z.number().int().min(0).default(0),
  /** 繧ｹ繧ｳ繧｢邂怜・譎ゅ・繝壹・繧ｸ繝薙Η繝ｼ縺ｮ驥阪∩ */
  rewardWeightView: z.number().int().min(0).default(1),
  /** 繧ｹ繧ｳ繧｢邂怜・譎ゅ・繝繧ｦ繝ｳ繝ｭ繝ｼ繝峨・驥阪∩ */
  rewardWeightDownload: z.number().int().min(0).default(5),
  /** 1繝励Ο繧ｸ繧ｧ繧ｯ繝医′蜿悶ｌ繧九せ繧ｳ繧｢繧ｷ繧ｧ繧｢縺ｮ荳企剞・井ｸ・・邇・ｼ峨りｶ・℃蛻・・莉悶∈蜀埼・蛻・☆繧・*/
  rewardMaxProjectShareBps: z.number().int().min(100).max(10000).default(2000),
  /** 縺薙ｌ譛ｪ貅縺ｮ驟榊・縺ｯ莉倅ｸ弱○縺夂ｿ梧悄縺ｸ郢ｰ繧願ｶ翫☆ */
  rewardMinPayoutPoints: z.number().int().min(1).default(1),

  // ---- 蜃ｺ驥・----
  /** 蜃ｺ驥醍筏隲九・譛菴弱・繧､繝ｳ繝医よ焔謨ｰ譁吶′逶ｸ蟇ｾ逧・↓螟ｧ縺阪￥縺ｪ繧峨↑縺・ｰｴ貅悶↓鄂ｮ縺・*/
  payoutMinPoints: z.number().int().min(1).default(1000),
  /** 縺薙ｌ繧定ｶ・∴繧句・驥代・閾ｪ蜍暮・≡縺帙★謇句虚蜃ｦ逅・↓蝗槭☆ */
  payoutAutoLimitPoints: z.number().int().min(0).default(5000),
  payoutPaypalEnabled: z.boolean().default(false),
  payoutGiftcardEnabled: z.boolean().default(false),
  /** 1pt 繧偵ぐ繝輔ヨ繧ｫ繝ｼ繝蛾｡埼擇縺・￥繧峨↓莠､謠帙☆繧九°縲ょ虻遞ｮ縺ｮ謇区焚譁吶ｒ蜷ｸ蜿弱☆繧・*/
  payoutGiftcardRate: z.number().min(0).max(1).default(1.0),
});

/** `"蜷榊燕 <address>"` 蠖｢蠑上・ From 繝倥ャ繝繧堤ｵ・∩遶九※繧・*/
export function formatMailFrom(settings: Pick<AppSettings, "mailFromAddress" | "mailFromName">): string {
  const name = settings.mailFromName.trim();
  return name ? `${name} <${settings.mailFromAddress}>` : settings.mailFromAddress;
}

export type AppSettings = z.infer<typeof appSettingsSchema>;

/** 繧ｹ繧ｭ繝ｼ繝樊里螳壼､縺ｮ縺ｿ縺ｧ讒区・縺励◆險ｭ螳・*/
export const DEFAULT_APP_SETTINGS: AppSettings = appSettingsSchema.parse({});

/** 邂｡逅・判髱｢縺ｮ繝輔か繝ｼ繝逕滓・縺ｫ菴ｿ縺・Γ繧ｿ諠・ｱ */
/** 邂｡逅・判髱｢縺ｮ縺ｩ縺ｮ繧ｿ繝悶↓蜃ｺ縺吶° */
export type AppSettingGroup = "general" | "ddos" | "reward";

export type AppSettingField = {
  key: keyof AppSettings;
  type: "number" | "boolean" | "string";
  /** 邂｡逅・判髱｢縺ｫ陦ｨ遉ｺ縺吶ｋ繝ｩ繝吶Ν・・18n 繧ｭ繝ｼ・・*/
  labelKey: string;
  helpKey: string;
  /** 逵∫払譎ゅ・ "general" */
  group?: AppSettingGroup;
};

/** 謖・ｮ壹げ繝ｫ繝ｼ繝励・繝輔ぅ繝ｼ繝ｫ繝峨ｒ蜿悶ｊ蜃ｺ縺・*/
export function getAppSettingFields(group: AppSettingGroup): AppSettingField[] {
  return APP_SETTING_FIELDS.filter((f) => (f.group ?? "general") === group);
}

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

/**
 * 菫晏ｭ俶ｸ医∩縺ｮ蛟､繧偵せ繧ｭ繝ｼ繝槭↓騾壹＠縺ｦ豁｣隕丞喧縺吶ｋ縲・
 * 螢翫ｌ縺溷､繝ｻ譛ｪ遏･縺ｮ繧ｭ繝ｼ繝ｻ繧ｹ繧ｭ繝ｼ繝櫁ｿｽ蜉蛻・・譌｢螳壼､縺ｧ蝓九ａ繧九◆繧√・
 * KV 縺ｮ蜀・ｮｹ縺悟商縺上※繧ょｮ牙・縺ｫ隱ｭ縺ｿ蜃ｺ縺帙∪縺吶・
 */
export function normalizeAppSettings(raw: unknown): AppSettings {
  const parsed = appSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // 荳驛ｨ縺ｮ繝輔ぅ繝ｼ繝ｫ繝峨□縺大｣翫ｌ縺ｦ縺・ｋ蝣ｴ蜷医↓蛯吶∴縲√ヵ繧｣繝ｼ繝ｫ繝牙腰菴阪〒繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺吶ｋ
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const field of APP_SETTING_FIELDS) {
    const single = appSettingsSchema.shape[field.key].safeParse(source[field.key]);
    merged[field.key] = single.success ? single.data : DEFAULT_APP_SETTINGS[field.key];
  }
  return appSettingsSchema.parse(merged);
}
