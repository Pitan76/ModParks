import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";


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
        if (!credentials?.email || !credentials?.password) return null;
        const { checkRateLimit } = await import("@/lib/rate-limit");
        const rlRes = await checkRateLimit("login", 10, 5 * 60 * 1000);
        if (!rlRes.success) throw new Error("TOO_MANY_REQUESTS");

        const { getDatabase } = await import("@/lib/db");
        const db = await getDatabase();
        const user = await db.select().from(users).where(eq(users.email, credentials.email as string)).get();

        if (!user || !user.passwordHash || user.deletedAt) return null;

        const passwordsMatch = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (passwordsMatch) {
          if (user.twoFactorEnabled) {
            if (!credentials.token) {
              throw new Error("2FA_REQUIRED");
            }
            const { TOTP } = await import("otpauth");
            const totp = new TOTP({ secret: user.twoFactorSecret as string });
            const delta = totp.validate({ token: credentials.token as string, window: 1 });
            if (delta === null) {
              throw new Error("INVALID_2FA_TOKEN");
            }
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: user.role,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (user?.email) {
        const { getDatabase } = await import("@/lib/db");
        const { users } = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDatabase();
        const dbUser = await db.select().from(users).where(eq(users.email, user.email as string)).get();
        
        // 退会済みユーザーのログインを拒否
        if (dbUser?.deletedAt) {
          return false;
        }

        // GitHub連携時に githubUsername を更新
        if (account?.provider === "github" && profile?.login) {
          await db.update(users).set({ githubUsername: profile.login as string }).where(eq(users.email, user.email as string));
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username ?? null;
        token.displayName = (user as any).displayName ?? null;
        token.avatarUrl = (user as any).avatarUrl ?? user.image ?? null;
        token.role = (user as any).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.id) as string;
        session.user.username = (token.username ?? null) as string | null;
        session.user.displayName = (token.displayName ?? null) as string | null;
        session.user.avatarUrl = (token.avatarUrl ?? null) as string | null;
        session.user.role = (token.role ?? "user") as string;
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
