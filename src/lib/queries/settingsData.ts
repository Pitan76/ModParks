/**
 * 設定画面の各ルートが必要とするユーザー情報の取得。
 *
 * セクションごとにルートを分けたため、必要なぶんだけを引ける粒度で用意する。
 */
import { eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db";
import {
  users,
  userProfiles,
  userSettings,
  apiKeys,
  accounts,
  authenticators,
} from "@/db/schema";

/** プロフィールタブ・アカウントタブが共通で使う表示用ユーザー情報 */
export type SettingsUser = {
  username: string;
  displayName: string;
  bio: string;
  email: string;
  avatarUrl: string;
  links: string;
  locale: "ja" | "en";
  githubUsername: string;
  showGithubLink: boolean;
};

export async function getSettingsUser(userId: string): Promise<SettingsUser> {
  const db = await getDatabase();
  const [userRecord, profile, settings] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).get(),
    db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get(),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).get(),
  ]);

  const custom = settings?.custom as Record<string, unknown> | null;

  return {
    username: profile?.username || "",
    displayName: profile?.displayName || "",
    bio: profile?.bio || "",
    email: userRecord?.email || "",
    avatarUrl: profile?.avatarUrl || "",
    links: profile?.links || "[]",
    locale: settings?.locale || "ja",
    githubUsername: profile?.githubUsername || "",
    showGithubLink: (custom?.showGithubLink as boolean | undefined) ?? true,
  };
}

/** ログイン方法まわり（パスワード有無・2段階認証・パスキー） */
export async function getSettingsCredentials(userId: string) {
  const db = await getDatabase();
  const [userRecord, passkeys] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).get(),
    db
      .select({
        credentialID: authenticators.credentialID,
        name: authenticators.name,
        createdAt: authenticators.createdAt,
      })
      .from(authenticators)
      .where(eq(authenticators.userId, userId)),
  ]);

  return {
    hasPassword: !!userRecord?.passwordHash,
    twoFactorEnabled: !!userRecord?.twoFactorEnabled,
    passkeys,
  };
}

export async function getSettingsApiKeys(userId: string) {
  const db = await getDatabase();
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
}

/** 投稿の既定値・通知設定・外部サービス連携をまとめて返す */
export async function getSettingsPreferences(userId: string) {
  const db = await getDatabase();
  const [settings, userAccounts] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).get(),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
  ]);

  return {
    defaultProjectStatus: settings?.defaultProjectStatus || "draft",
    defaultIdeaStatus: settings?.defaultIdeaStatus || "public",
    defaultProjectBodyFormat: settings?.defaultProjectBodyFormat || "markdown",
    defaultIdeaBodyFormat: settings?.defaultIdeaBodyFormat || "markdown",
    defaultCommentBodyFormat: settings?.defaultCommentBodyFormat || "markdown",
    defaultLicense: settings?.defaultLicense || "All Rights Reserved",
    defaultCommentsEnabled: settings?.defaultCommentsEnabled ?? false,
    defaultRecipesEnabled: settings?.defaultRecipesEnabled ?? false,
    modrinthApiKey: settings?.modrinthApiKey || "",
    curseforgeProjectId: settings?.curseforgeProjectId || "",
    curseforgeVerified: !!settings?.curseforgeVerifiedAt,
    curseforgeVerifyCode: settings?.curseforgeVerifyCode || "",
    curseforgeUploadApiToken: settings?.curseforgeUploadApiToken || "",
    notificationPrefs: settings?.notificationPrefs ?? null,
    discordWebhookUrl: settings?.discordWebhookUrl ?? "",
    isGitHubConnected: userAccounts.some((acc) => acc.provider === "github"),
    isGoogleConnected: userAccounts.some((acc) => acc.provider === "google"),
  };
}
