"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { users, userProfiles, userSettings, apiKeys, accounts, authenticators } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordDeletion } from "@/lib/backup/tombstone";


/**
 * プロフィール情報（表示名、Bio、アバターURL、リンク）を更新する Server Action。
 * 表示言語は設定画面がセクション分割されたため updateLocale が担当する。
 */
export const updateProfile = async (data: { displayName: string, bio: string, avatarUrl: string, links: string }) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userProfiles).set({
    displayName: data.displayName,
    bio: data.bio,
    avatarUrl: data.avatarUrl || null,
    links: data.links,
  }).where(eq(userProfiles.userId, userId));

  revalidatePath("/settings");
  revalidatePath("/profile");
  return { success: true };
};

/**
 * 表示言語のみを更新する Server Action。アカウント設定から呼ばれる。
 */
export const updateLocale = async (locale: "ja" | "en") => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userSettings).set({ locale }).where(eq(userSettings.userId, userId));

  revalidatePath("/", "layout");
  return { success: true };
};

/**
 * アバター画像のみを更新する Server Action。
 * プロフィールページ上でアイコンをタップした際の即時反映に使う。
 */
export const updateAvatar = async (avatarUrl: string) => {
  const { db, userId } = await getAuthenticatedDb();

  const url = avatarUrl?.trim() || null;
  await db.update(userProfiles).set({ avatarUrl: url }).where(eq(userProfiles.userId, userId));
  await db.update(users).set({ image: url }).where(eq(users.id, userId));

  revalidatePath("/settings");
  revalidatePath("/[locale]/profile/[username]", "page");
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
 * 指定したOAuthプロバイダーとの連携を解除する。
 * 解除するとログイン手段が一つも残らない場合は、締め出しを防ぐため拒否する。
 */
async function disconnectOAuthProvider(provider: string): Promise<{ success: boolean; error?: "NOT_CONNECTED" | "LAST_LOGIN_METHOD" }> {
  const { db, userId } = await getAuthenticatedDb();

  const [user, userAccounts, passkeys] = await Promise.all([
    db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).get(),
    db.select({ provider: accounts.provider }).from(accounts).where(eq(accounts.userId, userId)),
    db.select({ credentialID: authenticators.credentialID }).from(authenticators).where(eq(authenticators.userId, userId)),
  ]);

  if (!userAccounts.some((acc) => acc.provider === provider)) {
    return { success: false, error: "NOT_CONNECTED" };
  }

  const remainingMethods =
    (user?.passwordHash ? 1 : 0) +
    userAccounts.filter((acc) => acc.provider !== provider).length +
    passkeys.length;
  if (remainingMethods === 0) {
    return { success: false, error: "LAST_LOGIN_METHOD" };
  }

  await db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));

  revalidatePath("/settings");
  return { success: true };
}

/**
 * GitHubとのOAuth連携を解除する Server Action。
 */
export const disconnectGitHub = async () => {
  return disconnectOAuthProvider("github");
};

/**
 * GoogleとのOAuth連携を解除する Server Action。
 */
export const disconnectGoogle = async () => {
  return disconnectOAuthProvider("google");
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
export const updatePostingSettings = async (
  projectStatus: "draft" | "public" | "unlisted" | "private",
  ideaStatus: "draft" | "public" | "unlisted" | "private",
  projectBodyFormat: "markdown" | "plaintext" | "pukiwiki",
  ideaBodyFormat: "markdown" | "plaintext" | "pukiwiki",
  commentBodyFormat: "markdown" | "plaintext" | "pukiwiki",
  license: string,
  commentsEnabled: boolean,
  recipesEnabled: boolean
) => {
  const { db, userId } = await getAuthenticatedDb();

  await db.update(userSettings).set({
    defaultProjectStatus: projectStatus,
    defaultIdeaStatus: ideaStatus,
    defaultProjectBodyFormat: projectBodyFormat,
    defaultIdeaBodyFormat: ideaBodyFormat,
    defaultCommentBodyFormat: commentBodyFormat,
    defaultLicense: license,
    defaultCommentsEnabled: commentsEnabled,
    defaultRecipesEnabled: recipesEnabled,
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
