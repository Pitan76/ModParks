import { describe, expect, it } from "vitest";
import type { User } from "@/db/schema";
import { groupCleanVersionsByUser, projectScore } from "../src/lib/services/trustProjection";
import type { CleanVersion } from "../src/lib/services/trustActivity";
import { TRUST_BASE_SCORE } from "@/lib/trust/config";

const NOW = new Date("2026-08-06T00:00:00Z");
const DAY_MS = 86_400_000;

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    name: null,
    email: "u1@example.com",
    emailVerified: null,
    image: null,
    passwordHash: null,
    githubId: null,
    role: "user",
    twoFactorEnabled: false,
    premiumTier: "free",
    premiumUntil: null,
    twoFactorSecret: null,
    lastLoginAt: NOW,
    deletedAt: null,
    deactivatedAt: null,
    suspendedAt: null,
    createdAt: daysAgo(1),
    ...overrides,
  };
}

function cleanVersion(days: number, overrides: Partial<CleanVersion> = {}): CleanVersion {
  return {
    versionId: `v${days}`,
    uploaderId: "u1",
    authorId: "author",
    publishedAt: daysAgo(days),
    ...overrides,
  };
}

const project = (u: User, cleanVersions: CleanVersion[] = [], hasSocial = false) =>
  projectScore({ user: u, hasSocial, cleanVersions }, NOW);

describe("projectScore", () => {
  it("何もない新規ユーザは基準値のまま", () => {
    expect(project(user())).toBe(TRUST_BASE_SCORE);
  });

  it("ソーシャル連携済みなら 100 になる", () => {
    expect(project(user(), [], true)).toBe(100);
  });

  it("メール確認と 2FA が加算される", () => {
    const verified = user({ emailVerified: NOW, twoFactorEnabled: true });
    expect(project(verified)).toBe(TRUST_BASE_SCORE + 20 + 30);
  });
});

describe("在籍年数", () => {
  it("到達した段まで積まれる", () => {
    // 1 年経過 = 30日(+20) / 180日(+40) / 1年(+60)
    expect(project(user({ createdAt: daysAgo(365) }))).toBe(TRUST_BASE_SCORE + 120);
  });

  it("休眠アカウントには在籍加点を付けない", () => {
    const dormant = user({ createdAt: daysAgo(2000), lastLoginAt: daysAgo(400) });
    expect(project(dormant)).toBe(TRUST_BASE_SCORE);
  });

  it("lastLoginAt がなければ作成日を最終接触とみなす", () => {
    const neverLoggedIn = user({ createdAt: daysAgo(2000), lastLoginAt: null });
    expect(project(neverLoggedIn)).toBe(TRUST_BASE_SCORE);
  });
});

describe("過去の実績", () => {
  it("公開日を起点に減衰した分だけ加算される", () => {
    // 公開直後の +5 と、365日前で 0 になった分
    const versions = [cleanVersion(0), cleanVersion(365)];
    expect(project(user(), versions)).toBe(TRUST_BASE_SCORE + 5);
  });

  it("古い実績が上限の枠を占有しない", () => {
    const stale = Array.from({ length: 40 }, () => cleanVersion(400));
    const fresh = Array.from({ length: 40 }, () => cleanVersion(0));
    expect(project(user(), [...stale, ...fresh])).toBe(TRUST_BASE_SCORE + 200);
  });
});

describe("groupCleanVersionsByUser", () => {
  it("実行者ごとにまとめる", () => {
    const grouped = groupCleanVersionsByUser([
      cleanVersion(1, { uploaderId: "a" }),
      cleanVersion(2, { uploaderId: "a" }),
      cleanVersion(3, { uploaderId: "b" }),
    ]);

    expect(grouped.get("a")).toHaveLength(2);
    expect(grouped.get("b")).toHaveLength(1);
  });

  it("実行者が未記録の行は投稿者に寄せる", () => {
    const grouped = groupCleanVersionsByUser([
      cleanVersion(1, { uploaderId: null, authorId: "legacy" }),
    ]);

    expect(grouped.get("legacy")).toHaveLength(1);
  });
});
