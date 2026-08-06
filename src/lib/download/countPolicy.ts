/**
 * ダウンロードを統計に計上してよいかの判定。
 *
 * 過去に大量ダウンロードでカウンタが実態とかけ離れた値へ膨れ、統計として
 * 使えなくなったことがある。ダウンロード数は還元の配分根拠でもあるため、
 * 崩れると金銭配分の正当性まで壊れ、しかも正しい値へ戻せない。
 *
 * 計上しないことと配布を拒否することは別。ここで false になっても
 * ファイルは通常どおり配布する。
 */

/**
 * DDoS 防護の状態。Worker が判定済みの値をヘッダで受け取る。
 * Next.js 側から D1 を引き直すと 1 ダウンロードあたりの読み取りが増えるため。
 */
export const DDOS_STATE_HEADER = "x-mp-ddos-state";

/** Cloudflare の Bot 判定結果。同じく Worker が付与する */
export const BOT_HEADER = "x-mp-bot";

/** 防護が入っていない平常状態を表す値 */
const NORMAL_STATE = "NORMAL";

/** 計上しない場合の理由。ログと管理画面での可視化に使う */
export type SkipReason = "insider" | "silent" | "under_attack" | "bot";

export type CountDecision =
  | { countable: true }
  | { countable: false; reason: SkipReason };

type CountContext = {
  /** 作者・メンバーによる自己ダウンロードか */
  excludedFromCount: boolean;
  /** 管理者のサイレントダウンロードか */
  silent: boolean;
};

/**
 * リクエストの署名ヘッダから、計上対象かどうかを判定する。
 *
 * 防護中の数字は元々信用できないため、攻撃中のダウンロードは丸ごと捨てる。
 * 「少なく数える」方が「膨れた値を残す」より復旧可能で害が小さい。
 */
export function decideCountable(headers: Headers, ctx: CountContext): CountDecision {
  if (ctx.excludedFromCount) return { countable: false, reason: "insider" };
  if (ctx.silent) return { countable: false, reason: "silent" };

  const state = headers.get(DDOS_STATE_HEADER);
  if (state && state !== NORMAL_STATE) return { countable: false, reason: "under_attack" };

  if (headers.get(BOT_HEADER) === "1") return { countable: false, reason: "bot" };

  return { countable: true };
}
