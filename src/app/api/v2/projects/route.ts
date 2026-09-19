import { getDatabase } from "@/lib/db";
import { getSettingsKV } from "@/lib/kv";
import { handleListProjects } from "@modparks/core/api/v2/projects";

/**
 * 本体は core にあり、workers/api(Hono) からも同じものを呼んでいる。
 * 公開ルートが modparks-api に向いている間はそちらが処理するが、
 * ルートパターンを外せばここへ戻る。
 */
export async function GET(request: Request) {
  const [db, kv] = await Promise.all([getDatabase(), getSettingsKV()]);

  return handleListProjects({ db, kv }, request);
}
