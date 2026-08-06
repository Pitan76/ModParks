/**
 * GitHub App のインストール完了後に GitHub から戻ってくる先（App 設定の Setup URL）。
 *
 * ここで installation_id をログイン中のユーザーに紐づける。この紐づけが、
 * 「他人のインストールを使って非公開リポジトリを読む」ことを防ぐ唯一の関門になる。
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { githubInstallations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createInstallationToken } from "@/lib/utils/githubApp";

function redirectTo(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get("installation_id");
  const setupAction = req.nextUrl.searchParams.get("setup_action");
  const installationId = rawId ? Number(rawId) : NaN;

  if (!Number.isInteger(installationId)) {
    return redirectTo(req, "/ja/settings/integration?githubApp=error");
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    // 未ログインだと誰に紐づければよいか決められない。
    // GitHub Marketplace や App ページから直接インストールされた場合がこれにあたる。
    // installation_id を落とすとインストール済みなのに紐づけ不能になるので、
    // ログイン後にこのエンドポイントへ戻して続きから処理する。
    const callbackUrl = `/api/github/app/setup?installation_id=${installationId}${
      setupAction ? `&setup_action=${encodeURIComponent(setupAction)}` : ""
    }`;
    return redirectTo(req, `/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  try {
    const db = await getDatabase();

    if (setupAction === "delete") {
      // 削除済みの installation ではトークンを発行できないので、検証より先に処理する。
      // 自分の紐づけだけを消す。
      await db
        .delete(githubInstallations)
        .where(
          and(eq(githubInstallations.id, installationId), eq(githubInstallations.userId, userId))
        )
        .run();
      return redirectTo(req, "/ja/settings/integration?githubApp=removed");
    }

    // installation_id は URL パラメータで渡ってくるだけなので、そのまま信用しない。
    // App の資格情報で実際にトークンを発行できるかを確認し、所有アカウント名を得る。
    const token = await createInstallationToken(installationId);
    const res = await fetch("https://api.github.com/installation/repositories?per_page=1", {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "ModParks/1.0",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Installation verification failed. Status: ${res.status}`);

    const data = (await res.json()) as {
      repositories?: { owner?: { login?: string } }[];
    };
    const accountLogin = data.repositories?.[0]?.owner?.login ?? "";

    await db
      .insert(githubInstallations)
      .values({ id: installationId, userId, accountLogin })
      .onConflictDoUpdate({
        target: githubInstallations.id,
        set: { userId, accountLogin },
      })
      .run();

    return redirectTo(req, "/ja/settings/integration?githubApp=connected");
  } catch (e: unknown) {
    console.error("GitHub App setup failed:", e);
    return redirectTo(req, "/ja/settings/integration?githubApp=error");
  }
}
