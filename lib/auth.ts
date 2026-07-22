import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { authProviders } from "./authProviders";

/**
 * NextAuthの認証設定オブジェクト。
 * 認証プロバイダー設定と、セッション情報のカスタマイズ・データベース連携イベントを行います。
 */
export const authConfig = {
  providers: authProviders,
  events: {
    async createUser({ user }: { user: any }) {
      const { getDatabase } = await import("@/lib/db");
      const { userProfiles, userSettings } = await import("@/db/schema");
      const { generateUniqueUsername } = await import("@/lib/utils/username");
      const db = await getDatabase();

      try {
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
      } catch (e: unknown) {
        console.error("Failed to create profile/settings for new user:", e);
      }
    }
  },
  callbacks: {
    async signIn({ user, account, profile }: { user: any, account?: any, profile?: any }) {
      if (user?.email) {
        const { getDatabase } = await import("@/lib/db");
        const { users, userProfiles } = await import("@/db/schema");
        const { eq: drizzleEq } = await import("drizzle-orm");
        const db = await getDatabase();
        const dbUser = await db.select().from(users).where(drizzleEq(users.email, user.email as string)).get();
        
        if (account?.provider === "resend" && !dbUser) return "/ja/register";
        if (dbUser?.deletedAt) return false;

        if (account?.provider === "github" && profile?.login && dbUser) {
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
    async jwt({ token, user, trigger }: { token: any, user?: any, trigger?: any, session?: any }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username ?? null;
        token.displayName = (user as any).displayName ?? null;
        token.avatarUrl = (user as any).avatarUrl ?? user.image ?? null;
        token.role = (user as any).role ?? "user";
      }
      
      const now = Date.now();
      const TTL_MS = 5 * 60 * 1000;
      
      if (trigger === "update") token.lastDbCheck = 0;
      
      if (token.id && (!token.lastDbCheck || now - token.lastDbCheck > TTL_MS)) {
        try {
          const { getDatabase } = await import("@/lib/db");
          const db = await getDatabase();
          if (db) {
            const { users, userProfiles, userSettings: schemaSettings } = await import("@/db/schema");
            const { eq: drizzleEq } = await import("drizzle-orm");
            const dbUser = await db.select({
              role: users.role,
              deletedAt: users.deletedAt,
              avatarUrl: userProfiles.avatarUrl,
              displayName: userProfiles.displayName,
              username: userProfiles.username,
              locale: schemaSettings.locale,
              custom: schemaSettings.custom,
            }).from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .leftJoin(schemaSettings, eq(users.id, schemaSettings.userId))
            .where(drizzleEq(users.id, token.id as string)).get();
            
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
        } catch (e: unknown) {
          console.error("Failed to refresh user data in jwt callback", e);
        }
      }
      
      return token;
    },
    async session({ session, token }: { session: any, token?: any }) {
      if (session.user) {
        if (token?.isDeleted) return { ...session, user: undefined } as any;
        
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
    signIn: "/ja/login",
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
  } catch (e: unknown) {
    console.error("Failed to initialize D1 for NextAuth:", e);
  }

  return {
    ...authConfig,
    adapter,
  };
});
