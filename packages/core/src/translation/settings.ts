/**
 * 翻訳の実行パラメータ。管理画面（アプリ設定）から変更できる。
 *
 * 各モジュールが個別に KV を読むと呼び出し回数が読めなくなるため、
 * 入口で 1 度だけ解決し、以降は値を引き回す。
 */
import type { AppSettings } from "@modparks/core/config/appSettings";

export interface TranslationSettings {
  enabled: boolean;
  model: string;
  maxTokens: number;
  chunkChars: number;
  maxInputChars: number;
  dailyRunLimit: number;
  userHourlyLimit: number;
}

/** アプリ設定から翻訳の分だけを取り出す。設定の読み出し（KV）は呼び出し側で行う */
export function toTranslationSettings(settings: AppSettings): TranslationSettings {
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
