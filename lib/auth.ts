import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// @ts-expect-error D1 binding
const d1 = typeof process !== "undefined" ? process.env.DB : undefined;

export const authConfig = {
  adapter: d1 ? DrizzleAdapter(getDb(d1)) : undefined,
  providers: [
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { getD1 } = await import("@/lib/db");
        const d1 = await getD1();
        const db = getDb(d1);
        const user = await db.select().from(users).where(eq(users.email, credentials.email as string)).get();

        if (!user || !user.passwordHash) return null;

        const passwordsMatch = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (passwordsMatch) {
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.displayName = (user as any).displayName;
        token.avatarUrl = (user as any).avatarUrl || user.image;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? token.id as string;
        session.user.username = token.username as string;
        session.user.displayName = token.displayName as string;
        session.user.avatarUrl = token.avatarUrl as string | null;
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/ja/login", // Assuming local routing will handle this
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
