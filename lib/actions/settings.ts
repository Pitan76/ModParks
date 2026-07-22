"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { userProfiles, userSettings, apiKeys, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";


/**
 * プロフィール情報（表示名、Bio、アバターURL、リンク、使用言語）を更新する Server Action。
 */
export const updateProfile = async (data: { displayName: string, bio: string, avatarUrl: string, links: string, locale: "ja" | "en" }) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userProfiles).set({
    displayName: data.displayName,
    bio: data.bio,
    avatarUrl: data.avatarUrl || null,
    links: data.links,
  }).where(eq(userProfiles.userId, userId));

  await db.update(userSettings).set({
    locale: data.locale,
  }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
};

/**
 * APIキーを生成し、SHA-256でハッシュ化した値を保存して生のキーを返す Server Action。
 */
export const generateApiKey = async (name: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const rawKey = "mp_" + crypto.randomUUID().replace(/-/g, "");
  
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedKey = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  await db.insert(apiKeys).values({
    key: hashedKey,
    name: name,
    userId: userId,
  });

  revalidatePath("/settings");
  return { success: true, key: rawKey };
};

/**
 * IDを指定してAPIキーを削除する Server Action。
 */
export const deleteApiKey = async (id: string) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(apiKeys).where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
  await recordDeletion(db, "api_keys", id);

  revalidatePath("/settings");
  return { success: true };
};

/**
 * GitHubとのOAuth連携を解除する Server Action。
 */
export const disconnectGitHub = async () => {
  const { db, userId } = await getAuthenticatedDb();

  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, "github")));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * プロフィール上でのGitHubリンク表示・非表示を切り替える Server Action。
 */
export const toggleGithubVisibility = async (show: boolean) => {
  const { db, userId } = await getAuthenticatedDb();

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (!settings) return { error: "Settings not found" };

  const customObj = (settings.custom as Record<string, any>) || {};
  customObj.showGithubLink = show;

  await db.update(userSettings).set({ custom: customObj }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
};

/**
 * デフォルトのMOD投稿設定（公開設定、既定ライセンス）を更新する Server Action。
 */
export const updatePostingSettings = async (status: "draft" | "public" | "unlisted" | "private", license: string) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userSettings).set({
    defaultProjectStatus: status,
    defaultLicense: license,
  }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * Modrinth等の外部インテグレーションAPIキーを更新する Server Action。
 */
export const updateIntegrations = async (modrinthKey: string) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userSettings).set({
    modrinthApiKey: modrinthKey?.trim() || null,
  }).where(eq(userSettings.userId, userId));

  revalidatePath("/settings");
  return { success: true };
};

/**
 * 初回オンボーディング完了をマークする Server Action。
 */
export const completeOnboarding = async () => {
  const { db, userId } = await getAuthenticatedDb();

  const settings = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).get();
  if (!settings) return { error: "Settings not found" };

  const customObj = (settings.custom as Record<string, any>) || {};
  customObj.onboardingCompleted = true;

  await db.update(userSettings).set({ custom: customObj }).where(eq(userSettings.userId, userId));

  revalidatePath("/");
  return { success: true };
};
