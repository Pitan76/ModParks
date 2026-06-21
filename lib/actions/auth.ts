"use server";

import { getDatabase } from "@/lib/db";
import { users, userProfiles, userSettings, verificationTokens, passwordResetTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import { createId } from "@paralleldrive/cuid2";
import { SITE_URL } from "@/lib/config";

export async function sendRegistrationEmail(formData: FormData) {
  const email = formData.get("email") as string;
  const locale = (formData.get("locale") as string) || "ja";

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("register", 5, 15 * 60 * 1000); // 5 times per 15 min
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  if (!email) return { error: "emailRequired" };

  const db = await getDatabase();
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) return { error: "emailTaken" };

  // Generate a random token
  const token = createId() + createId();
  const identifier = `register:${email}`;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Insert or update token
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier)).run();
  await db.insert(verificationTokens).values({ identifier, token, expires }).run();

  // Send Email using Resend
  const link = `${SITE_URL}/${locale}/register/complete?token=${token}&email=${encodeURIComponent(email)}`;
  
  const subject = locale === "ja" ? "【ModParks】ご登録を完了してください" : "Complete your ModParks registration";
  const html = locale === "ja" 
    ? `<p>ModParksへのご登録ありがとうございます。</p><p>以下のリンクをクリックして、ユーザー名とパスワードを設定して登録を完了してください：</p><p><a href="${link}">${link}</a></p><p>このリンクは24時間有効です。</p>`
    : `<p>Thank you for registering on ModParks.</p><p>Please click the link below to set your username and password and complete your registration:</p><p><a href="${link}">${link}</a></p><p>This link is valid for 24 hours.</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "ModParks <no-reply@modparks.pitan76.net>",
        to: email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Resend API error:", await res.text());
      return { error: "emailSendFailed" };
    }
  } catch (e) {
    console.error("Failed to send email:", e);
    return { error: "emailSendFailed" };
  }

  return { success: true };
}

export async function registerUser(formData: FormData) {
  const username    = formData.get("username") as string;
  const displayName = formData.get("displayName") as string;
  const email       = formData.get("email") as string;
  const password    = formData.get("password") as string;
  const token       = formData.get("token") as string;
  
  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("register_complete", 10, 5 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  if (!username || !displayName || !email || !password || !token) {
    return { error: "allFieldsRequired" };
  }

  if (password.length < 8) {
    return { error: "passwordLength" };
  }

  const db = await getDatabase();

  // Validate token
  const identifier = `register:${email}`;
  const validToken = await db
    .select()
    .from(verificationTokens)
    .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
    .get();

  if (!validToken || new Date(validToken.expires) < new Date()) {
    return { error: "invalidToken" };
  }

  // 重複チェック
  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existingEmail) {
    return { error: "emailTaken" };
  }

  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.username, username))
    .get();
    
  if (existingProfile) {
    return { error: "usernameTaken" };
  }

  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 8);
  const id = createId();

  await db.insert(users).values({
    id,
    name: displayName,
    email,
    emailVerified: new Date(),
    passwordHash,
    role: "user",
  }).run();

  await db.insert(userProfiles).values({
    userId: id,
    username,
    displayName,
  }).run();

  await db.insert(userSettings).values({
    userId: id,
  }).run();

  // Consume token
  await db.delete(verificationTokens).where(eq(verificationTokens.identifier, identifier)).run();

  return { success: true };
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;
  const locale = (formData.get("locale") as string) || "ja";

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("reset_password", 3, 15 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  if (!email) return { error: "emailRequired" };

  const db = await getDatabase();
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  
  if (!user) {
    // Return success even if user doesn't exist to prevent email enumeration
    return { success: true };
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id)).run();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  }).run();

  const link = `${SITE_URL}/${locale}/reset-password?token=${token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.AUTH_RESEND_KEY}`
    },
    body: JSON.stringify({
      from: "no-reply@modparks.pitan76.net",
      to: email,
      subject: locale === "en" ? "Reset your password" : "パスワードの再設定",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>${locale === "en" ? "Reset your password" : "パスワードの再設定"}</h2>
          <p>${locale === "en" ? "Click the button below to reset your password. This link will expire in 1 hour." : "下のボタンをクリックしてパスワードを再設定してください。このリンクの有効期限は1時間です。"}</p>
          <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
            ${locale === "en" ? "Reset Password" : "パスワードを再設定する"}
          </a>
        </div>
      `
    })
  });

  if (!res.ok) {
    console.error("Failed to send reset email", await res.text());
    return { error: "failedToSendEmail" };
  }

  return { success: true };
}

export async function resetPasswordWithToken(formData: FormData) {
  const token = formData.get("token") as string;
  const newPassword = formData.get("password") as string;

  if (!token || !newPassword) return { error: "invalidData" };

  const { checkRateLimit } = await import("@/lib/rate-limit");
  const rlRes = await checkRateLimit("reset_password_confirm", 5, 15 * 60 * 1000);
  if (!rlRes.success) return { error: "TOO_MANY_REQUESTS" };

  const db = await getDatabase();
  const resetToken = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).get();

  if (!resetToken) return { error: "invalidToken" };
  if (resetToken.expiresAt.getTime() < Date.now()) return { error: "tokenExpired" };

  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(newPassword, 8); // Using 8 to avoid Cloudflare Workers 50ms CPU limit

  await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId)).run();
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetToken.id)).run();

  return { success: true };
}
