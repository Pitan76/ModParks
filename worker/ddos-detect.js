import {
  getDdosConfig,
  BACKOFF_WINDOW_MS,
  COOLDOWN_AFTER_API_FAILURE_MS,
  EVALUATION_WINDOW_SEC,
  MAX_PROTECTION_DURATION_MS,
} from "./ddos-config.js";
import { toggleDdosProtection } from "./ddos-waf.js";
import { invalidateDdosState } from "./ddos-state.js";
import { recordDdosAudit, notifyActivated, notifyActivationFailed } from "./ddos-notify.js";

/** 同一 Isolate 内で判定が多重に走らないようにする */
let isTransitioning = false;

const SUM_SLICES_SQL =
  "SELECT SUM(request_count) as total_requests, SUM(download_count) as total_downloads, " +
  "SUM(unique_ip_count) as dispersion_score, SUM(unique_country_count) as approx_countries " +
  "FROM ddos_slices WHERE slice_time >= ?";

const TOP_SLUG_SQL =
  "SELECT top_slug, SUM(top_slug_count) as total_slug_count FROM ddos_slices " +
  "WHERE slice_time >= ? AND top_slug IS NOT NULL GROUP BY top_slug ORDER BY total_slug_count DESC LIMIT 1";

/** 直近スライスを集計し、判定に使う指標へ変換する。データが無ければ null */
async function collectMetrics(env, thresholdTime) {
  const stats = await env.DB.prepare(SUM_SLICES_SQL).bind(thresholdTime).first();
  if (!stats || !stats.total_requests) return null;

  const topSlugRow = await env.DB.prepare(TOP_SLUG_SQL).bind(thresholdTime).first();

  const totalRequests = stats.total_requests;
  const totalDownloads = stats.total_downloads || 0;
  const dispersionScore = stats.dispersion_score || 0;
  const topSlugCount = topSlugRow ? topSlugRow.total_slug_count : 0;

  return {
    totalRequests,
    totalDownloads,
    dispersionScore,
    approxCountries: stats.approx_countries || 0,
    topSlug: topSlugRow ? topSlugRow.top_slug : "",
    downloadRatio: totalRequests > 0 ? totalDownloads / totalRequests : 0,
    topSlugRatio:  totalRequests > 0 ? topSlugCount / totalRequests : 0,
    ipRepeatRate:  dispersionScore > 0 ? totalRequests / dispersionScore : 0,
  };
}

/** 攻撃検知の4条件をすべて満たすか */
function isAttack(metrics, config) {
  return metrics.totalRequests >= config.thresholdRequests
    && metrics.downloadRatio >= config.thresholdDownloadRatio
    && metrics.topSlugRatio >= config.thresholdTopSlugRatio
    && metrics.ipRepeatRate >= config.thresholdIpRepeatRate;
}

/**
 * 今回適用する防護時間を決める。
 * 前回の復帰から間もない再検知は「解除が早すぎた」とみなし、バックオフで倍に伸ばす。
 */
async function resolveProtectionDuration(env, config, now) {
  const record = await env.DB.prepare(
    "SELECT protection_duration, last_normal_at FROM ddos_state WHERE state_key = 'global'"
  ).first();
  if (!record) return config.defaultDuration;

  if (now - record.last_normal_at > BACKOFF_WINDOW_MS) return config.defaultDuration;

  const extended = Math.min(record.protection_duration * 2, MAX_PROTECTION_DURATION_MS);
  console.log(`[DDOS-GUARD] Backoff activated. Extending duration to ${extended / 60000} mins`);
  return extended;
}

/** WAF有効化に成功した場合の状態遷移 */
async function commitActivation(env, metrics, now, protectionDuration) {
  const scheduledDisableAt = now + protectionDuration;
  await env.DB.prepare(
    "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', attack_detected_at = ?, under_attack_enabled_at = ?, scheduled_disable_at = ?, protection_duration = ?, updated_at = ? WHERE state_key = 'global'"
  ).bind(now, now, scheduledDisableAt, protectionDuration, now).run();

  invalidateDdosState();
  console.log("[DDOS-GUARD] Successfully enabled WAF custom rule.");

  await recordDdosAudit(env.DB, "auto_activate", "UNDER_ATTACK", {
    topSlug: metrics.topSlug || null,
    totalRequests: metrics.totalRequests,
    totalDownloads: metrics.totalDownloads,
    downloadRatio: Number(metrics.downloadRatio.toFixed(3)),
    topSlugRatio:  Number(metrics.topSlugRatio.toFixed(3)),
    ipRepeatRate:  Number(metrics.ipRepeatRate.toFixed(2)),
    dispersionScore: metrics.dispersionScore,
    approxCountries: metrics.approxCountries,
    protectionDuration,
    scheduledDisableAt,
    dryRun: env.DRY_RUN === "true",
  });

  await notifyActivated(env, { ...metrics, protectionDuration });
}

/** WAF有効化に失敗した場合、APIを叩き続けないよう COOLDOWN へ退避する */
async function commitActivationFailure(env, metrics, now, error) {
  console.error("[DDOS-GUARD] Cloudflare API failure:", error);

  const cooldownUntil = now + COOLDOWN_AFTER_API_FAILURE_MS;
  await env.DB.prepare(
    "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, updated_at = ? WHERE state_key = 'global'"
  ).bind(cooldownUntil, now).run();

  invalidateDdosState();

  await recordDdosAudit(env.DB, "auto_activate_failed", "COOLDOWN", {
    topSlug: metrics.topSlug || null,
    totalRequests: metrics.totalRequests,
    error,
    cooldownUntil,
  });

  await notifyActivationFailed(env, error);
}

/**
 * 直近の統計から攻撃を判定し、該当すれば WAF を有効化する。
 * 複数 Isolate が同時に判定するため、遷移は D1 の条件付き UPDATE で1つだけが勝つようにしている。
 */
export async function evaluateAndTriggerDdos(env, sliceTime) {
  if (isTransitioning) return;
  isTransitioning = true;

  // Isolate 全体を巻き込まないよう、評価中の例外はここで止める
  try {
    const metrics = await collectMetrics(env, sliceTime - EVALUATION_WINDOW_SEC);
    if (!metrics) return;

    console.log(`[DDOS-GUARD] Evaluation: reqs=${metrics.totalRequests}, dls=${metrics.totalDownloads}(${(metrics.downloadRatio * 100).toFixed(1)}%), dispersion=${metrics.dispersionScore}, repeatRate=${metrics.ipRepeatRate.toFixed(2)}, topSlug=${metrics.topSlug}(${(metrics.topSlugRatio * 100).toFixed(1)}%)`);

    const config = await getDdosConfig(env);
    if (!isAttack(metrics, config)) return;

    console.log(`[DDOS-GUARD] Attack detected! Reqs=${metrics.totalRequests}, IPrepeat=${metrics.ipRepeatRate.toFixed(2)}, slug=${metrics.topSlug}`);

    const now = Date.now();
    // D1 の条件付き UPDATE による楽観ロック。負けた Isolate は何もしない
    const lockRes = await env.DB.prepare(
      "UPDATE ddos_state SET current_state = 'ACTIVATING', updated_at = ? WHERE state_key = 'global' AND current_state = 'NORMAL'"
    ).bind(now).run();
    if (lockRes.meta.changes !== 1) return;

    console.log("[DDOS-GUARD] Won activation lock. Calling Cloudflare API...");
    const protectionDuration = await resolveProtectionDuration(env, config, now);
    const apiRes = await toggleDdosProtection(env, true, metrics.topSlug);

    if (apiRes.success) {
      await commitActivation(env, metrics, now, protectionDuration);
      return;
    }
    await commitActivationFailure(env, metrics, now, apiRes.error);
  } catch (err) {
    console.error("[DDOS-GUARD] Error in evaluateAndTriggerDdos:", err);
  } finally {
    isTransitioning = false;
  }
}
