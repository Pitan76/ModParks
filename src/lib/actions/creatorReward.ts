"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDatabase } from "@/lib/db";
import { userSettings } from "@/db/schema";

/**
 * クリエイタ還元への参加/辞退を切り替える。
 * 辞退しているユーザーは月次計算で配分対象から外れる。
 */
export async function setCreatorRewardOptIn(
  optIn: boolean
): Promise<{ success: true } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };

  const db = await getDatabase();

  // 設定行はユーザー作成時に必ず作られるとは限らないため、無ければ作る
  await db
    .insert(userSettings)
    .values({ userId: session.user.id, creatorRewardOptIn: optIn })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { creatorRewardOptIn: optIn },
    })
    .run();

  revalidatePath("/settings/rewards");
  return { success: true };
}

/** 現在の参加状態を返す。設定行が無ければ未参加として扱う */
export async function getCreatorRewardOptIn(userId: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db
    .select({ optIn: userSettings.creatorRewardOptIn })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();

  return row?.optIn ?? false;
}
