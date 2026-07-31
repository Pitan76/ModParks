"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { users, settingsAudit, backupAudit, ddosState, ddosAudit } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";
import { recordModerationAudit } from "@/lib/actions/moderationAudit";
import { recordDdosAudit } from "@/lib/actions/ddosAudit";

export async function updateUserRole(targetUserId: string, newRole: "user" | "admin") {
  const { db, session } = await getAdminDb();

  // Prevents self-demotion to avoid locking out the only admin
  if (targetUserId === session.user.id && newRole === "user") {
    throw new Error("Cannot demote yourself");
  }

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  await recordModerationAudit(db, "role_change", targetUserId, session.user.id, { newRole });
  revalidatePath("/admin/users");
  return { success: true };
}

export async function toggleUserSuspension(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) {
    throw new Error("Cannot suspend yourself");
  }

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const newSuspendedAt = user.suspendedAt ? null : new Date();

  await db.update(users).set({ suspendedAt: newSuspendedAt }).where(eq(users.id, targetUserId));
  await recordModerationAudit(db, newSuspendedAt ? "suspend_user" : "unsuspend_user", targetUserId, session.user.id);
  
  revalidatePath("/admin/users");
  return { success: true, suspended: !!newSuspendedAt };
}

/**
 * プレミアムを手動で付与する。販売は未実施のため、付与経路は当面この管理操作のみ。
 * @param days 有効日数。未指定（null）なら無期限
 */
export async function grantPremium(targetUserId: string, days: number | null = null) {
  const { db, session } = await getAdminDb();

  if (days !== null && (!Number.isFinite(days) || days <= 0 || days > 3650)) {
    throw new Error("Invalid premium duration");
  }

  const user = await db.select({ id: users.id }).from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const premiumUntil = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.update(users)
    .set({ premiumTier: "premium", premiumUntil })
    .where(eq(users.id, targetUserId));

  await recordModerationAudit(db, "premium_grant", targetUserId, session.user.id, {
    days,
    until: premiumUntil?.toISOString() ?? null,
  });

  revalidatePath("/admin/users");
  return { success: true, premiumUntil: premiumUntil ? premiumUntil.getTime() : null };
}

/** プレミアムを取り消す */
export async function revokePremium(targetUserId: string) {
  const { db, session } = await getAdminDb();

  await db.update(users)
    .set({ premiumTier: "free", premiumUntil: null })
    .where(eq(users.id, targetUserId));

  await recordModerationAudit(db, "premium_revoke", targetUserId, session.user.id);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUsernameByAdmin(targetUserId: string, newUsername: string) {
  const { db } = await getAdminDb();
  const { userProfiles, userSettings, users } = await import("@/db/schema");
  
  if (!newUsername || !/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
    throw new Error("Invalid username format. Use alphanumeric characters, hyphens, and underscores.");
  }

  const existing = await db.select().from(userProfiles).where(eq(userProfiles.username, newUsername)).get();
  if (existing && existing.userId !== targetUserId) {
    throw new Error("Username already taken by another user.");
  }

  const targetProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).get();
  
  if (targetProfile) {
    await db.update(userProfiles).set({ username: newUsername }).where(eq(userProfiles.userId, targetUserId));
  } else {
    const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
    if (!user) throw new Error("User not found");
    
    await db.insert(userProfiles).values({
      userId: targetUserId,
      username: newUsername,
      displayName: user.name || "Unknown",
      avatarUrl: user.image,
    });
    
    const settings = await db.select().from(userSettings).where(eq(userSettings.userId, targetUserId)).get();
    if (!settings) {
      await db.insert(userSettings).values({ userId: targetUserId });
    }
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();
  const { userProfiles } = await import("@/db/schema");

  if (targetUserId === session.user.id) {
    throw new Error("Cannot delete yourself");
  }

  const user = await db.select().from(users).where(eq(users.id, targetUserId)).get();
  if (!user) throw new Error("User not found");

  const timestamp = Date.now();
  const scrambledEmail = user.email ? `deleted_${timestamp}_${user.email}` : null;
  const scrambledGithubId = user.githubId ? `deleted_${timestamp}_${user.githubId}` : null;

  // Soft delete by setting deletedAt and scrambling unique fields so they can be reused
  await db.update(users).set({ 
    deletedAt: new Date(),
    email: scrambledEmail,
    githubId: scrambledGithubId
  }).where(eq(users.id, targetUserId));

  // Scramble username as well to free it up
  const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetUserId)).get();
  if (profile) {
    await db.update(userProfiles).set({
      username: `deleted_${timestamp}_${profile.username}`
    }).where(eq(userProfiles.userId, targetUserId));
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function purgeDeletedUsers() {
  const { db } = await getAdminDb();
  const { isNotNull } = await import("drizzle-orm");

  // 墓標を残すため、削除前に対象の id を控えておく
  const targets = await db
    .select({ id: users.id })
    .from(users)
    .where(isNotNull(users.deletedAt))
    .all();

  // Hard delete all users where deletedAt is not null
  await db.delete(users).where(isNotNull(users.deletedAt));

  await recordDeletion(db, "users", targets.map((u: { id: string }) => u.id));

  revalidatePath("/admin/users");
  return { success: true };
}

export async function hardDeleteUser(targetUserId: string) {
  const { db, session } = await getAdminDb();

  if (targetUserId === session.user.id) {
    throw new Error("Cannot delete yourself");
  }

  // Hard delete the specific user
  await db.delete(users).where(eq(users.id, targetUserId));

  await recordDeletion(db, "users", targetUserId);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function adminDeleteProject(projectId: string) {
  const { db } = await getAdminDb();
  const { projects } = await import("@/db/schema");
  
  await db.delete(projects).where(eq(projects.id, projectId));
  await recordDeletion(db, "projects", projectId);

  revalidatePath("/admin/projects");
  revalidatePath("/projects");
  return { success: true };
}

export async function adminDeleteIdea(ideaId: string) {
  const { db } = await getAdminDb();
  const { ideas } = await import("@/db/schema");
  
  await db.delete(ideas).where(eq(ideas.id, ideaId));
  await recordDeletion(db, "ideas", ideaId);

  revalidatePath("/admin/ideas");
  revalidatePath("/ideas");
  return { success: true };
}

export async function getSettingsAudits(limit = 50, offset = 0) {
  const { db } = await getAdminDb();
  
  const logs = await db
    .select()
    .from(settingsAudit)
    .orderBy(desc(settingsAudit.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(settingsAudit)
    .get();

  return { logs, total: countRes?.count ?? 0 };
}

export async function getBackupAudits(limit = 50, offset = 0) {
  const { db } = await getAdminDb();

  const logs = await db
    .select()
    .from(backupAudit)
    .orderBy(desc(backupAudit.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(backupAudit)
    .get();

  return { logs, total: countRes?.count ?? 0 };
}

// ─── Cloudflare WAF PATCH Action ───
async function toggleWaf(enable: boolean, topSlug = "") {
  const isDryRun = process.env.DRY_RUN === "true";
  console.log(`[DDOS-ACTION] toggleWaf: enable=${enable}, topSlug=${topSlug}, dryRun=${isDryRun}`);

  if (isDryRun) {
    return { success: true };
  }

  const token = process.env.CF_WAF_API_TOKEN;
  const zoneId = process.env.CF_ZONE_ID;
  const rulesetId = process.env.CF_RULESET_ID;
  const ruleId = process.env.CF_WAF_RULE_ID;

  if (!token || !zoneId || !rulesetId || !ruleId) {
    console.error("[DDOS-ACTION] Missing Cloudflare API configuration environment variables");
    return { success: false, error: "Missing config" };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`;

  const isSafeSlug = topSlug && /^[a-z0-9-]{1,64}$/.test(topSlug);
  const expression = (enable && isSafeSlug)
    ? `(http.request.uri.path contains "/api/download" and http.request.uri.args["slug"][0] eq "${topSlug}")`
    : `(http.request.uri.path contains "/api/download")`;

  const body = enable
    ? { enabled: true, expression, action: "managed_challenge" }
    : { enabled: false, expression: `(http.request.uri.path eq "/dev/null")`, action: "managed_challenge" };

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const data: any = await res.json();
    if (!res.ok || !data.success) {
      const errMsg = data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDdosStateAction() {
  const { db } = await getAdminDb();
  let state = await db.select().from(ddosState).where(eq(ddosState.stateKey, "global")).get();
  if (!state) {
    const now = Date.now();
    await db.insert(ddosState).values({
      stateKey: "global",
      currentState: "NORMAL",
      attackDetectedAt: 0,
      underAttackEnabledAt: 0,
      scheduledDisableAt: 0,
      cooldownUntil: 0,
      updatedAt: now,
      protectionDuration: 600000,
      lastNormalAt: 0,
    }).run();
    state = await db.select().from(ddosState).where(eq(ddosState.stateKey, "global")).get();
  }
  return state;
}

export async function toggleManualUnderAttack(enable: boolean, durationMinutes = 10) {
  const { db, userId } = await getAdminDb();
  const now = Date.now();

  const before = await db.select({ currentState: ddosState.currentState })
    .from(ddosState)
    .where(eq(ddosState.stateKey, "global"))
    .get();

  const apiRes = await toggleWaf(enable, "");
  if (!apiRes.success) {
    return { error: `Cloudflare API error: ${apiRes.error}` };
  }

  if (enable) {
    const durationMs = durationMinutes * 60 * 1000;
    const scheduledDisableAt = now + durationMs;

    await db.update(ddosState)
      .set({
        currentState: "UNDER_ATTACK",
        attackDetectedAt: now,
        underAttackEnabledAt: now,
        scheduledDisableAt: scheduledDisableAt,
        protectionDuration: durationMs,
        updatedAt: now,
      })
      .where(eq(ddosState.stateKey, "global"))
      .run();
  } else {
    await db.update(ddosState)
      .set({
        currentState: "NORMAL",
        updatedAt: now,
        scheduledDisableAt: 0,
        protectionDuration: 600000,
      })
      .where(eq(ddosState.stateKey, "global"))
      .run();
  }

  await recordDdosAudit(
    db,
    enable ? "manual_activate" : "manual_deactivate",
    enable ? "UNDER_ATTACK" : "NORMAL",
    {
      previousState: before?.currentState ?? null,
      ...(enable ? { protectionDuration: durationMinutes * 60 * 1000 } : {}),
    },
    userId
  );

  revalidatePath("/admin/config");
  return { success: true };
}

export async function getDdosAudits(limit = 50, offset = 0) {
  const { db } = await getAdminDb();

  const logs = await db
    .select()
    .from(ddosAudit)
    .orderBy(desc(ddosAudit.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(ddosAudit)
    .get();

  return { logs, total: countRes?.count ?? 0 };
}
