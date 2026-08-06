/**
 * 運用モードの切替と自動復帰。
 *
 * 自動での縮退は行わず、自動復帰だけ行う。
 * 誤検知で勝手に止まると被害が大きいが、戻し忘れて止まったままになるのも
 * 同じくらい困る。「入るのは人間、戻るのは自動」が安全側。
 */
import { getRuntimeConfig, putRuntimeConfig } from "@/lib/runtime/state";
import { effectiveMode, type RuntimeMode } from "@/lib/runtime/features";

/** 期限のプリセット(時間)。管理画面のボタンと対応させる */
export const MODE_DURATION_PRESETS_HOURS = [1, 6, 24, 72];

/** 既定の期限(時間)。長すぎると戻し忘れ、短すぎると調査中に戻ってしまう */
export const DEFAULT_MODE_HOURS = 6;

/** 期限の上限(時間)。これ以上は「無期限」と変わらない */
export const MAX_MODE_HOURS = 72;

export type ModeChange = {
  mode: RuntimeMode;
  /** NORMAL 以外では必須 */
  reason: string;
  /** NORMAL 以外では必須。時間単位 */
  durationHours: number;
};

/**
 * 期限切れのモードを NORMAL へ戻す。
 *
 * 判定側は期限を見て既に通常運用として振る舞っているため、
 * これは状態の後始末にあたる。
 *
 * @returns 戻したなら true
 */
export async function expireModeIfDue(): Promise<boolean> {
  const config = await getRuntimeConfig();
  const state = config.mode;
  if (!state || state.mode === "NORMAL") return false;

  // MAINTENANCE は復旧作業中であることが多く、勝手に戻ると危険
  if (state.mode === "MAINTENANCE") return false;
  if (effectiveMode(config) !== "NORMAL") return false;

  await putRuntimeConfig({
    ...config,
    mode: { mode: "NORMAL", changedAt: Date.now() },
  });
  return true;
}

/**
 * モードを切り替える。
 *
 * @throws Error 期限や理由が不足している場合
 */
export async function applyModeChange(change: ModeChange): Promise<void> {
  const config = await getRuntimeConfig();

  if (change.mode === "NORMAL") {
    await putRuntimeConfig({ ...config, mode: { mode: "NORMAL", changedAt: Date.now() } });
    return;
  }

  if (!change.reason.trim()) throw new Error("Reason is required");
  if (change.durationHours <= 0 || change.durationHours > MAX_MODE_HOURS) {
    throw new Error(`Duration must be between 1 and ${MAX_MODE_HOURS} hours`);
  }

  await putRuntimeConfig({
    ...config,
    mode: {
      mode: change.mode,
      until: Date.now() + change.durationHours * 3_600_000,
      reason: change.reason.trim(),
      changedAt: Date.now(),
    },
  });
}
