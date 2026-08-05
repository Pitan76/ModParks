/**
 * Cloudflare の Bot 判定。
 *
 * 統計の計上除外と、コスト分析での内訳表示に使う。
 * Bot Management のフィールドはプランによって欠けるため、
 * 無い場合は Bot ではないとみなす（計上を止める側に倒さない）。
 */

/** Cloudflare が「自動化されたリクエスト」とみなすスコアの上限 */
const BOT_SCORE_THRESHOLD = 30;

/** @returns Bot と判定できれば true */
export function isBotRequest(req) {
  const bot = req.cf?.botManagement;
  if (!bot) return false;
  if (bot.verifiedBot) return true;

  return typeof bot.score === "number" && bot.score <= BOT_SCORE_THRESHOLD;
}
