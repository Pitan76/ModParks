/**
 * 機能スイッチの共通ガード。
 *
 * 個別に判定を書くと、機能を足すたびに漏れる。
 * 停止できる操作は必ずこの 1 本を通すこと。
 */
import { getRuntimeConfig } from "@/lib/runtime/state";
import { isFeatureEnabled, type RuntimeFeature } from "@/lib/runtime/features";

/** 機能が停止されているときに投げる。呼び出し元は 503 として扱う */
export class FeatureDisabledError extends Error {
  constructor(readonly feature: RuntimeFeature, readonly reason?: string) {
    super(`Feature disabled: ${feature}`);
    this.name = "FeatureDisabledError";
  }
}

/**
 * 機能が停止されていれば例外を投げる。
 *
 * Server Action や Route Handler の入口でのみ呼ぶこと。
 * 内部ロジックに判定を持ち込むと、どこで止まるのかが追えなくなる。
 */
export async function assertFeatureEnabled(feature: RuntimeFeature): Promise<void> {
  const config = await getRuntimeConfig();
  if (isFeatureEnabled(config, feature)) return;

  throw new FeatureDisabledError(feature, config.features[feature]?.reason);
}

/** 例外を投げずに可否だけ知りたい場合に使う（画面の出し分けなど） */
export async function checkFeatureEnabled(feature: RuntimeFeature): Promise<boolean> {
  return isFeatureEnabled(await getRuntimeConfig(), feature);
}
