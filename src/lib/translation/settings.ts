/**
 * 翻訳の実行パラメータ。管理画面（アプリ設定）から変更できる。
 *
 * 各モジュールが個別に KV を読むと呼び出し回数が読めなくなるため、
 * 入口で 1 度だけ解決し、以降は値を引き回す。
 */
import { getAppSettings } from "@/lib/config/readSettings";

export interface TranslationSettings {
  enabled: boolean;
  model: string;
  maxTokens: number;
  chunkChars: number;
  maxInputChars: number;
  dailyRunLimit: number;
  userHourlyLimit: number;
}

export async function getTranslationSettings(): Promise<TranslationSettings> {
  const settings = await getAppSettings();
  return {
    enabled:         settings.translationEnabled,
    model:           settings.translationModel,
    maxTokens:       settings.translationMaxTokens,
    chunkChars:      settings.translationChunkChars,
    maxInputChars:   settings.translationMaxInputChars,
    dailyRunLimit:   settings.translationDailyRunLimit,
    userHourlyLimit: settings.translationUserHourlyLimit,
  };
}
