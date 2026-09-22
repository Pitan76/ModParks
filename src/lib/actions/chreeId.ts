"use server";

import { getAuthenticatedDb } from "@/lib/auth-helpers";
import { isChreeIdProvisioningEnabled } from "@/lib/chreeid/client";
import { requestChreeIdClaimUrl } from "@/lib/chreeid/provisioner";

type ClaimResult =
  | { success: true; claimUrl: string }
  | { success: true; alreadyClaimed: true }
  | { success: false; error: "NOT_CONFIGURED" | "CLAIM_FAILED" };

/**
 * 本人を ChreeID の引き取り画面へ送るための URL を取る。
 * ModParks のアカウントはそのまま残り、引き取ったあとは ChreeID でもログインできる。
 */
export async function startChreeIdClaim(): Promise<ClaimResult> {
  const { db, userId } = await getAuthenticatedDb();
  if (!isChreeIdProvisioningEnabled()) return { success: false, error: "NOT_CONFIGURED" };

  let claimUrl: string | null;
  try {
    claimUrl = await requestChreeIdClaimUrl(db, userId);
  } catch (e: unknown) {
    console.warn("[ChreeID] claim url failed:", userId, e);
    return { success: false, error: "CLAIM_FAILED" };
  }

  if (claimUrl === null) return { success: true, alreadyClaimed: true };
  return { success: true, claimUrl };
}
