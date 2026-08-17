import { dependencyDraftsSchema } from "@/lib/validations";
import type { DependencyDraft } from "@/lib/dependencies/types";

/**
 * フォームから来た依存関係の下書き（JSON文字列）を検証して取り出す。
 *
 * 依存が無いのが普通なので、未指定は空配列として扱い、
 * 壊れた JSON だけをエラーにする。
 */
export function parseDependencyDraftsField(
  raw: FormDataEntryValue | null,
): { success: true; data: DependencyDraft[] } | { success: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return { success: true, data: [] };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, error: "Invalid dependencies payload" };
  }

  const parsed = dependencyDraftsSchema.safeParse(json);
  if (!parsed.success) return { success: false, error: "Invalid dependencies payload" };

  return { success: true, data: parsed.data };
}
