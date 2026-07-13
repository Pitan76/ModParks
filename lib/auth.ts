import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import * as schema from "@/db/schema";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";



/**
 * NextAuthの認証設定オブジェクト。
 * GitHub OAuthの設定と、セッション情報のカスタマイズを行います。
 */
export const authConfig = {
  providers: [
    Resend({
      from: "no-reply@modparks.pitan76.net",
    }),
    GitHub({
      clientId:     process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          username: profile.login,
          displayName: profile.name ?? profile.login,
          avatarUrl: profile.avatar_url,
          githubId: profile.id.toString(),
          role: "user",
        };
      },
    }),
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "2FA Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[Auth] Missing credentials");
          return null;
        }
        
        try {
          const { checkRateLimit } = await import("@/lib/rate-limit");
          const rlRes = await checkRateLimit("login", 10, 5 * 60 * 1000);
          if (!rlRes.success) {
            console.log("[Auth] Rate limited");
            throw new Error("TOO_MANY_REQUESTS");
          }

          const { getDatabase } = await import("@/lib/db");
          const db = await getDatabase();
          const { users, userProfiles } = await import("@/db/schema");
          const record = await db.select()
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.email, credentials.email as string))
            .get();

          if (!record?.users) {
            console.log("[Auth] User not found:", credentials.email);
            return null;
          }
          const user = record.users;
          const profile = record.user_profiles;

          if (!user.passwordHash) {
            console.log("[Auth] User has no passwordHash:", credentials.email);
            return null;
          }
          if (user.deletedAt) {
            console.log("[Auth] User is deleted:", credentials.email);
            return null;
          }

          const { default: bcrypt } = await import("bcryptjs");
          const passwordsMatch = await bcrypt.compare(credentials.password as string, user.passwordHash);
          if (!passwordsMatch) {
            console.log("[Auth] Password mismatch for user:", credentials.email);
            return null;
          }

          if (user.twoFactorEnabled) {
            if (!credentials.token || credentials.token === "undefined") {
              const { CredentialsSignin } = await import("next-auth");
              class TwoFactorRequiredError extends CredentialsSignin {
                code = "2FA_REQUIRED";
              }
              throw new TwoFactorRequiredError();
            }
            const { TOTP } = await import("otpauth");
            const totp = new TOTP({ secret: user.twoFactorSecret as string });
            const delta = totp.validate({ token: credentials.token as string, window: 1 });
            if (delta === null) {
              const { CredentialsSignin } = await import("next-auth");
              class InvalidTwoFactorError extends CredentialsSignin {
                code = "INVALID_2FA_TOKEN";
              }
              throw new InvalidTwoFactorError();
            }
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            username: profile?.username,
            displayName: profile?.displayName,
            avatarUrl: profile?.avatarUrl,
            role: user.role,
          };
        } catch (e: any) {
          console.error("[Auth] Error in authorize:", e);
          throw e;
        }
      },
    }),
  ],
  events: {
    async createUser({ user }: { user: any }) {
      const { getDatabase } = await import("@/lib/db");
      const { userProfiles, userSettings } = await import("@/db/schema");
      const { generateUniqueUsername } = await import("@/lib/utils/username");
      const db = await getDatabase();

      try {
        // UUID をそのまま username にすると公開URLが /profile/<UUID> になり
        // ユーザー名機能が破綻するため、人間可読で一意な username を生成する
        const username = await generateUniqueUsername(db, {
          email: user.email,
          name: user.name,
        });
        await db.insert(userProfiles).values({
          userId: user.id as string,
          username,
          displayName: user.name || "Unknown",
          avatarUrl: user.image,
        }).run();
        
        await db.insert(userSettings).values({
          userId: user.id as string,
        }).run();
      } catch (e) {
        console.error("Failed to create profile/settings for new user:", e);
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile }: { user: any, account?: any, profile?: any }) {
      if (user?.email) {
        const { getDatabase } = await import("@/lib/db");
        const { users, userProfiles } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDatabase();
        const dbUser = await db.select().from(users).where(eq(users.email, user.email as string)).get();
        
        // マジックリンクログイン時、ユーザーが存在しない場合は新規作成させず登録画面へリダイレクト
        if (account?.provider === "resend" && !dbUser) {
          return "/ja/register";
        }

        // 退会済みユーザーのログインを拒否
        if (dbUser?.deletedAt) {
          return false;
        }

        // GitHub連携時に githubUsername を更新
        if (account?.provider === "github" && profile?.login && dbUser) {
          // profile 未作成の稀なケースでも UUID を username にしないよう生成する
          const { generateUniqueUsername } = await import("@/lib/utils/username");
          const fallbackUsername = await generateUniqueUsername(db, {
            email: dbUser.email,
            name: profile.login as string,
          });
          await db.insert(userProfiles).values({
            userId: dbUser.id,
            username: fallbackUsername,
            githubUsername: profile.login as string,
          }).onConflictDoUpdate({
            target: userProfiles.userId,
            set: { githubUsername: profile.login as string }
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }: { token: any, user?: any, trigger?: any, session?: any }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username ?? null;
        token.displayName = (user as any).displayName ?? null;
        token.avatarUrl = (user as any).avatarUrl ?? user.image ?? null;
        token.role = (user as any).role ?? "user";
      }
      
      const now = Date.now();
      const TTL_MS = 5 * 60 * 1000; // 5 minutes
      
      if (trigger === "update") {
        token.lastDbCheck = 0; // Force refresh
      }
      
      if (token.id && (!token.lastDbCheck || now - token.lastDbCheck > TTL_MS)) {
        try {
          const { getDatabase } = await import("@/lib/db");
          const db = await getDatabase();
          if (db) {
            const { users, userProfiles, userSettings } = await import("@/db/schema");
            const { eq } = await import("drizzle-orm");
            const dbUser = await db.select({
              role: users.role,
              deletedAt: users.deletedAt,
              avatarUrl: userProfiles.avatarUrl,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              locale: userSettings.locale,
              custom: userSettings.custom,
            }).from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .leftJoin(userSettings, eq(users.id, userSettings.userId))
            .where(eq(users.id, token.id as string)).get();
            
            if (dbUser) {
              token.role = dbUser.role as string;
              token.isDeleted = !!dbUser.deletedAt;
              if (dbUser.avatarUrl) token.avatarUrl = dbUser.avatarUrl;
              if (dbUser.displayName) token.displayName = dbUser.displayName;
              if (dbUser.username) token.username = dbUser.username;
              if (dbUser.locale) token.locale = dbUser.locale;
              
              let customObj: any = {};
              if (typeof dbUser.custom === "string") {
                try { customObj = JSON.parse(dbUser.custom); } catch (_) {}
              } else if (dbUser.custom) {
                customObj = dbUser.custom;
              }
              token.onboardingCompleted = !!customObj?.onboardingCompleted;
            }
            token.lastDbCheck = now;
          }
        } catch (e) {
          console.error("Failed to refresh user data in jwt callback", e);
        }
      }
      
      return token;
    },
    async session({ session, token }: { session: any, token?: any }) {
      if (session.user) {
        if (token?.isDeleted) {
          return { ...session, user: undefined } as any;
        }
        
        session.user.id = (token.sub ?? token.id) as string;
        session.user.username = (token.username ?? null) as string | null;
        session.user.displayName = (token.displayName ?? null) as string | null;
        session.user.avatarUrl = (token.avatarUrl ?? null) as string | null;
        session.user.role = (token.role ?? "user") as string;
        session.user.locale = (token.locale ?? null) as string | null;
        session.user.onboardingCompleted = !!token?.onboardingCompleted;
      }
      return session;
    },
  },
  pages: {
    signIn: "/ja/login", // Assuming local routing will handle this
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  let adapter;
  try {
    const { getDatabase } = await import("@/lib/db");
    const db = await getDatabase();
    if (db) {
      adapter = DrizzleAdapter(
        db,
        {
          usersTable: schema.users as any,
          accountsTable: schema.accounts as any,
          sessionsTable: schema.sessions as any,
          verificationTokensTable: schema.verificationTokens as any,
        }
      );
    }
  } catch (e) {
    console.error("Failed to initialize D1 for NextAuth:", e);
  }

  return {
    ...authConfig,
    adapter,
  };
});
