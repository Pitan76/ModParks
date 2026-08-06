/**
 * 属性由来の加点を台帳へ反映する。
 *
 * 「イベントが起きた瞬間に積む」のではなく「現在の状態を見て、足りない分を積む」形にしている。
 * 記録は冪等なので何度呼んでも二重加点にならず、
 * 加点漏れがあっても次のバッチで自動的に埋まる。
 */
import { eq, isNull, and } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import { users, userProfiles, accounts, type User } from "@/db/schema";
import { TRUST_ACCOUNT_AGE_STEPS, TRUST_DORMANT_DAYS } from "@/lib/trust/config";
import { recordTrustEvent } from "./trust";

const DAY_MS = 86_400_000;

/** ソーシャル連携の有無。プロバイダ数によらず 1 回だけ加点する */
export async function hasSocialAccount(userId: string): Promise<boolean> {
  const db = await getDatabase();
  const linked = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .get();

  if (linked) return true;

  const profile = await db
    .select({ githubUsername: userProfiles.githubUsername })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .get();

  return Boolean(profile?.githubUsername);
}

/**
 * メール確認・2FA・ソーシャル連携の加点を、現在の状態に合わせる。
 * 連携解除の取り消しは扱わない（打ち消しイベントの担当、→ 設計 3.3）。
 */
export async function syncTrustAttributes(user: User): Promise<void> {
  if (user.emailVerified) {
    await recordTrustEvent({ userId: user.id, kind: "email_verified" });
  }
  if (user.twoFactorEnabled) {
    await recordTrustEvent({ userId: user.id, kind: "two_factor_enabled" });
  }
  if (await hasSocialAccount(user.id)) {
    await recordTrustEvent({ userId: user.id, kind: "social_linked" });
  }
}

/** 最終ログインが古すぎるアカウントは在籍加点を進めない */
function isDormant(user: User, now: Date): boolean {
  const lastSeen = user.lastLoginAt ?? user.createdAt;
  return now.getTime() - lastSeen.getTime() > TRUST_DORMANT_DAYS * DAY_MS;
}

/**
 * 在籍期間の加点を、到達済みの段まで積む。
 *
 * occurredAt には「その段に到達した日」を入れる。記録日ではない。
 * 遡って投入したときに減衰の起点がずれないようにするため。
 */
export async function syncAccountAge(user: User, now: Date = new Date()): Promise<void> {
  if (isDormant(user, now)) return;

  const ageDays = (now.getTime() - user.createdAt.getTime()) / DAY_MS;

  for (const [kind, requiredDays] of TRUST_ACCOUNT_AGE_STEPS) {
    if (ageDays < requiredDays) break;
    await recordTrustEvent({
      userId: user.id,
      kind,
      occurredAt: new Date(user.createdAt.getTime() + requiredDays * DAY_MS),
    });
  }
}

/** バッチ 1 回で処理するユーザ数の既定値 */
const BATCH_SIZE = 200;

/**
 * 有効なユーザを対象に属性と在籍年数を同期する。
 * 削除・停止済みは対象外（スコアを動かす意味がないため）。
 */
export async function syncTrustForActiveUsers(limit = BATCH_SIZE): Promise<number> {
  const db = await getDatabase();
  const targets = await db
    .select()
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.suspendedAt)))
    .limit(limit)
    .all();

  const now = new Date();
  for (const user of targets) {
    await syncTrustAttributes(user);
    await syncAccountAge(user, now);
  }
  return targets.length;
}
