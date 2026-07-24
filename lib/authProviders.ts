import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import { DEFAULT_APP_SETTINGS } from "@/lib/config/appSettings";
import { eq } from "drizzle-orm";

/**
 * NextAuthで使用する認証プロバイダー（Resend, GitHub, Credentials）の設定配列。
 * 2FA (TOTP) やレートリミットなどのカスタム認可ロジックが含まれています。
 */
export const authProviders = [
  Resend({
    from: DEFAULT_APP_SETTINGS.mailFromAddress,
    async sendVerificationRequest({ identifier: to, provider, url }) {
      const { host } = new URL(url);
      const { getAppSettings } = await import("@/lib/config/readSettings");
      const { formatMailFrom } = await import("@/lib/config/appSettings");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: formatMailFrom(await getAppSettings()),
          to,
          subject: `Sign in to ${host}`,
          html: `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Sign in to ${host}</h2>
            <p><a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Sign in</a></p>
            <p style="color: #666; font-size: 12px;">If you did not request this email, you can safely ignore it.</p>
          </div>`,
          text: `Sign in to ${host}\n${url}\n\nIf you did not request this email, you can safely ignore it.\n`,
        }),
      });
      if (!res.ok) throw new Error("Resend error: " + JSON.stringify(await res.json()));
    },
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
      } catch (e: unknown) {
        console.error("[Auth] Error in authorize:", e);
        throw e;
      }
    },
  }),
  Credentials({
    id: "passkey",
    name: "Passkey",
    credentials: { response: { label: "Passkey Response", type: "text" } },
    async authorize(credentials) {
      if (!credentials?.response) return null;
      try {
        const { checkRateLimit } = await import("@/lib/rate-limit");
        const rlRes = await checkRateLimit("passkey-login", 20, 5 * 60 * 1000);
        if (!rlRes.success) throw new Error("TOO_MANY_REQUESTS");

        const parsed = JSON.parse(credentials.response as string) as AuthenticationResponseJSON;
        const { verifyPasskeyLogin } = await import("@/lib/webauthn/verifyLogin");
        return await verifyPasskeyLogin(parsed);
      } catch (e: unknown) {
        console.error("[Auth] Error in passkey authorize:", e);
        throw e;
      }
    },
  }),
];
