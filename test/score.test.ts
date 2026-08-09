import { describe, expect, it } from "vitest";
import type { TrustEvent, TrustEventKind } from "@/db/schema";
import { computeScore, effectiveDelta, resolveTier, tierFromScore } from "../src/lib/trust/score";
import { TRUST_BASE_SCORE } from "../src/lib/trust/config";

const NOW = new Date("2026-08-06T00:00:00Z");
const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

let seq = 0;

/** 台帳の 1 行。テストで意味を持つ列だけを引数に取る */
function event(
  kind: TrustEventKind,
  delta: number,
  options: { days?: number; decays?: boolean; id?: string } = {},
): TrustEvent {
  const id = options.id ?? `e${++seq}`;
  return {
    id,
    userId: "u1",
    kind,
    delta,
    decays: options.decays ?? delta > 0,
    subjectType: "none",
    subjectId: id,
    reversesEventId: null,
    reason: null,
    actorEmail: null,
    occurredAt: daysAgo(options.days ?? 0),
    createdAt: daysAgo(options.days ?? 0),
  };
}

function reversalOf(target: TrustEvent): TrustEvent {
  return { ...event("reversal", 0), reversesEventId: target.id };
}

const score = (events: TrustEvent[], frozen = false) =>
  computeScore(events, { now: NOW, frozen });

describe("computeScore", () => {
  it("イベントがなければ基準値のまま", () => {
    expect(score([])).toBe(TRUST_BASE_SCORE);
  });

  it("ソーシャル登録相当の開始スコアは 100 になる", () => {
    expect(score([event("social_linked", 50, { decays: false })])).toBe(100);
  });

  it("0 未満と 1000 超は丸める", () => {
    expect(score([event("malware_detected", -5000)])).toBe(0);
    expect(score([event("manual_grant", 5000, { decays: false })])).toBe(1000);
  });
});

describe("減衰", () => {
  it("行動由来の加点は 365 日で 0 になる", () => {
    const fresh = event("version_clean", 5, { days: 0 });
    const half = event("version_clean", 5, { days: 182 });
    const gone = event("version_clean", 5, { days: 365 });

    expect(effectiveDelta(fresh, NOW)).toBe(5);
    expect(effectiveDelta(half, NOW)).toBe(3);
    expect(effectiveDelta(gone, NOW)).toBe(0);
  });

  it("属性由来の加点は時間が経っても減らない", () => {
    const linked = event("social_linked", 50, { days: 2000, decays: false });
    expect(effectiveDelta(linked, NOW)).toBe(50);
  });
});

describe("上限", () => {
  const cleanEvents = (count: number, days: number) =>
    Array.from({ length: count }, () => event("version_clean", 5, { days }));

  it("同一種別の寄与は上限で頭打ちになる", () => {
    expect(score(cleanEvents(60, 0))).toBe(TRUST_BASE_SCORE + 200);
  });

  it("減衰しきった古いイベントが上限の枠を占有しない", () => {
    // 上限に達するだけの古い実績を持つユーザが、新しく投稿を続けている状況。
    // 古い分から数えて打ち切る実装だと、ここで新しい分が弾かれてスコアが下がる。
    const events = [...cleanEvents(40, 400), ...cleanEvents(40, 0)];
    expect(score(events)).toBe(TRUST_BASE_SCORE + 200);
  });

  it("上限のない種別は合算され続ける", () => {
    const grants = [
      event("manual_grant", 30, { decays: false }),
      event("manual_grant", 30, { decays: false }),
    ];
    expect(score(grants)).toBe(TRUST_BASE_SCORE + 60);
  });
});

describe("減点の半減", () => {
  it("180 日を過ぎた減点は半分になる", () => {
    expect(effectiveDelta(event("report_upheld_against", -60, { days: 179 }), NOW)).toBe(-60);
    expect(effectiveDelta(event("report_upheld_against", -60, { days: 181 }), NOW)).toBe(-30);
  });

  it("半減は 1 回だけで、それ以上は軽くならない", () => {
    expect(effectiveDelta(event("report_upheld_against", -60, { days: 2000 }), NOW)).toBe(-30);
  });

  it("マルウェアだけは時間で軽くならない", () => {
    expect(effectiveDelta(event("malware_detected", -400, { days: 2000 }), NOW)).toBe(-400);
  });
});

describe("打ち消し", () => {
  it("打ち消された元イベントは計算から外れる", () => {
    const penalty = event("scan_evasion", -150);
    expect(score([penalty, reversalOf(penalty)])).toBe(TRUST_BASE_SCORE);
  });

  it("打ち消しイベント自体はスコアを動かさない", () => {
    const grant = event("manual_grant", 40, { decays: false });
    const other = event("scan_evasion", -150);
    expect(score([grant, other, reversalOf(other)])).toBe(TRUST_BASE_SCORE + 40);
  });
});

describe("frozen", () => {
  const events = [
    event("manual_grant", 100, { decays: false }),
    event("scan_evasion", -150),
  ];

  it("凍結中は加点を無視する", () => {
    expect(score(events, true)).toBe(0);
  });

  it("凍結中でも減点は反映する", () => {
    // 加点だけを止める。調査中のアカウントに減点が入らないのでは本末転倒になる。
    expect(score([event("scan_evasion", -150)], true)).toBe(0);
    expect(score([event("manual_grant", 100, { decays: false })], true)).toBe(TRUST_BASE_SCORE);
  });
});

describe("段階", () => {
  it("境界値がドキュメントどおりに割れる", () => {
    expect(tierFromScore(0)).toBe("restricted");
    expect(tierFromScore(29)).toBe("restricted");
    expect(tierFromScore(30)).toBe("new");
    expect(tierFromScore(50)).toBe("new");
    expect(tierFromScore(149)).toBe("new");
    expect(tierFromScore(150)).toBe("member");
    expect(tierFromScore(299)).toBe("member");
    expect(tierFromScore(300)).toBe("trusted");
    expect(tierFromScore(699)).toBe("trusted");
    expect(tierFromScore(700)).toBe("veteran");
    expect(tierFromScore(1000)).toBe("veteran");
  });

  it("マルウェア確定でスコアを 0 にすると、どの段階からでも restricted に落ちる", () => {
    const veteran = 900;
    expect(tierFromScore(veteran)).toBe("veteran");
    expect(score([event("malware_detected", -veteran)])).toBe(0);
  });
});

describe("resolveTier", () => {
  it("上書きがなければスコアから導出する", () => {
    expect(resolveTier(50, null, NOW)).toBe("new");
  });

  it("上書きがあればそちらを使う", () => {
    const override = { tierOverride: "trusted" as const, tierOverrideUntil: null };
    expect(resolveTier(50, override, NOW)).toBe("trusted");
  });

  it("期限を過ぎた上書きは通常計算に戻る", () => {
    const override = { tierOverride: "trusted" as const, tierOverrideUntil: daysAgo(1) };
    expect(resolveTier(50, override, NOW)).toBe("new");
  });

  it("期限内の上書きは有効なまま", () => {
    const until = new Date(NOW.getTime() + DAY_MS);
    const override = { tierOverride: "restricted" as const, tierOverrideUntil: until };
    expect(resolveTier(900, override, NOW)).toBe("restricted");
  });
});
