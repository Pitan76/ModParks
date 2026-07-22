"use server";

import { getDatabase } from "@/lib/db";
import { versions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * IDを指定してバージョン詳細を取得する Server Action。
 */
export const getVersionById = async (versionId: string) => {
  const db = await getDatabase();
  
  const version = await db
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .get();

  if (!version) return null;

  return version;
};
