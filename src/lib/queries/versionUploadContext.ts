import { posts, ideas } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";
import { getAvailablePlatforms } from "@/lib/queries/masterData";
import { getExternalSyncAvailability } from "@/lib/queries/externalSyncAvailability";
import type { Database } from "@/lib/db";

/**
 * バージョン追加フォームが必要とする、どの入口でも同一であるべき前提データ。
 *
 * このフォームは「バージョン追加ページ」と「プロジェクト編集画面のダイアログ」の
 * 2 箇所から開かれる。個別に props を並べていると片方だけ更新して取りこぼす
 * （実際に Modrinth/CurseForge の同時アップロードがページ側に出なかった）ため、
 * 必須の前提はこの型に束ねて、両方が {@link loadVersionUploadContext} から受け取る。
 */
export type VersionUploadContext = {
  slug: string;
  openIdeas: { id: string; title: string }[];
  availablePlatforms: { slug: string; name: string }[];
  /** Modrinth に同時アップロードできるか（連携済み かつ APIキー設定済み） */
  modrinthSyncAvailable: boolean;
  /** CurseForge に同時アップロードできるか（連携済み かつ アップロードトークン設定済み） */
  curseforgeSyncAvailable: boolean;
};

/**
 * {@link VersionUploadContext} を一度に組み立てる。
 * 新しい前提を足すときは必ずここに足せば、両方の入口へ自動的に行き渡る。
 */
export async function loadVersionUploadContext(
  db: Database,
  project: { slug: string; modrinthId: string | null; curseforgeId: string | null },
  userId: string | undefined,
): Promise<VersionUploadContext> {
  const [openIdeas, availablePlatforms, sync] = await Promise.all([
    db
      .select({ id: posts.id, title: posts.title })
      .from(ideas)
      .innerJoin(posts, eq(posts.id, ideas.id))
      .where(inArray(ideas.status, ["open", "in_progress"]))
      .all(),
    getAvailablePlatforms(),
    getExternalSyncAvailability(db, project, userId),
  ]);

  return {
    slug: project.slug,
    openIdeas,
    availablePlatforms,
    modrinthSyncAvailable: sync.modrinth,
    curseforgeSyncAvailable: sync.curseforge,
  };
}
