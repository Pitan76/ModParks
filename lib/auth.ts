import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [
    GitHub({
      clientId:     process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.githubId    = String((profile as { id: number }).id);
        token.login       = (profile as { login: string }).login;
        token.avatarUrl   = (profile as { avatar_url: string }).avatar_url;
        token.displayName = (profile as { name: string }).name ?? token.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id          = token.sub ?? "";
        session.user.githubId    = token.githubId as string;
        session.user.username    = token.login as string;
        session.user.displayName = token.displayName as string;
        session.user.avatarUrl   = token.avatarUrl as string;
        session.user.role        = (token.role as string) ?? "user";
      }
      return session;
    },
  },
  pages: {
    signIn: "/api/auth/signin",
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
