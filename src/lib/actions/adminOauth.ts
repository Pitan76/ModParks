"use server";

import { getAdminDb } from "@/lib/auth-helpers";
import { oauthClients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * OAuth クライアントの公式連携（isTrusted）を切り替えます。
 * @param clientId クライアントID
 * @param isTrusted 公式連携にするかどうか
 */
export async function toggleOAuthClientTrusted(clientId: string, isTrusted: boolean) {
  try {
    const { db } = await getAdminDb();
    
    await db.update(oauthClients)
      .set({ isTrusted })
      .where(eq(oauthClients.id, clientId));

    revalidatePath("/[locale]/admin/oauth", "page");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * OAuth クライアントの無効化状態（disabledAt）を切り替えます。
 * @param clientId クライアントID
 * @param isDisabled 無効化するかどうか
 */
export async function toggleOAuthClientDisabled(clientId: string, isDisabled: boolean) {
  try {
    const { db } = await getAdminDb();
    
    await db.update(oauthClients)
      .set({ disabledAt: isDisabled ? new Date() : null })
      .where(eq(oauthClients.id, clientId));

    revalidatePath("/[locale]/admin/oauth", "page");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
