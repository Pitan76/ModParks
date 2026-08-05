/**
 * スナップショットに載せる公開情報の抽出。
 *
 * 出す項目は publicView.ts のホワイトリストに従う。
 * バックアップと同じデータ源だが、こちらは公開前提なので
 * 「公開範囲」と「項目」の二重の絞り込みを必ず通す。
 */
import { and, eq, isNull } from "drizzle-orm";
import { posts, projects, userProfiles, users, versions } from "@/db/schema";
import { getR2PublicUrl } from "@/lib/r2";
import {
  SNAPSHOT_VISIBILITY,
  type PublicAuthor,
  type PublicProjectDetail,
  type PublicProjectSummary,
  type PublicVersion,
} from "./publicView";

type Db = Parameters<typeof eq>[0] extends never ? never : any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** JSON 文字列の配列カラムを配列へ。壊れていても落とさない */
function toArray(raw: string | null): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** 外部URLならそのまま、R2 のキーなら公開URLへ */
function toPublicFileUrl(fileUrl: string): string {
  return fileUrl.startsWith("http") ? fileUrl : getR2PublicUrl(fileUrl);
}

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  bodyFormat: string;
  createdAt: Date;
  updatedAt: Date;
  type: string;
  license: string;
  iconUrl: string | null;
  sourceUrl: string | null;
  issueTrackerUrl: string | null;
  links: string | null;
  downloads: number;
  authorId: string;
  authorName: string | null;
  authorUsername: string;
  authorAvatarUrl: string | null;
};

/**
 * スナップショットへ載せてよい条件。
 *
 * 一度 CDN へ載せると取り下げが即座には効かないため、通常の公開判定より
 * 厳しく絞る。判定はこの 1 か所に集約し、条件を足すときも必ずここへ書く。
 *
 * - visibility: public のみ。**限定公開(unlisted)は載せない**。
 *   URL を知る人だけに見せる前提のものを、一覧や検索インデックスへ出すと
 *   前提が崩れる
 * - 作者が退会・退会予約・凍結している場合は載せない。
 *   本人の情報（表示名・アバター）も一緒に出てしまうため
 */
function publishableCondition() {
  return and(
    eq(posts.kind, "project"),
    eq(posts.visibility, SNAPSHOT_VISIBILITY),
    isNull(users.deletedAt),
    isNull(users.deactivatedAt),
    isNull(users.suspendedAt)
  );
}

/** 公開プロジェクトを作者情報つきで取得する */
async function selectPublicProjects(db: Db): Promise<ProjectRow[]> {
  return db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      body: posts.body,
      bodyFormat: posts.bodyFormat,
      createdAt: posts.createdAt,
      updatedAt: posts.updatedAt,
      type: projects.type,
      license: projects.license,
      iconUrl: projects.iconUrl,
      sourceUrl: projects.sourceUrl,
      issueTrackerUrl: projects.issueTrackerUrl,
      links: projects.links,
      downloads: projects.downloads,
      authorId: posts.authorId,
      authorName: userProfiles.displayName,
      authorUsername: userProfiles.username,
      authorAvatarUrl: userProfiles.avatarUrl,
    })
    .from(posts)
    .innerJoin(projects, eq(projects.id, posts.id))
    .innerJoin(users, eq(users.id, posts.authorId))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(publishableCondition())
    .all();
}

/** 公開してよいバージョン。アーカイブ済みと malicious は載せない */
async function selectPublicVersions(db: Db, projectId: string): Promise<PublicVersion[]> {
  const rows = await db
    .select({
      versionNumber: versions.versionNumber,
      loaders: versions.loaders,
      mcVersions: versions.mcVersions,
      fileUrl: versions.fileUrl,
      scanStatus: versions.scanStatus,
      createdAt: versions.createdAt,
    })
    .from(versions)
    .where(and(eq(versions.projectId, projectId), isNull(versions.archivedAt)))
    .all();

  return rows
    .filter((row: { scanStatus: string }) => row.scanStatus !== "malicious")
    .map((row: {
      versionNumber: string;
      loaders: string | null;
      mcVersions: string | null;
      fileUrl: string;
      createdAt: Date;
    }) => ({
      versionNumber: row.versionNumber,
      loaders: toArray(row.loaders),
      mcVersions: toArray(row.mcVersions),
      externalUrl: toPublicFileUrl(row.fileUrl),
      releasedAt: row.createdAt.getTime(),
    }));
}

function toSummary(row: ProjectRow): PublicProjectSummary {
  return {
    slug: row.slug,
    title: row.title,
    type: row.type,
    iconUrl: row.iconUrl,
    downloads: row.downloads,
    authorName: row.authorName || row.authorUsername,
    updatedAt: row.updatedAt.getTime(),
  };
}

export type SnapshotData = {
  summaries: PublicProjectSummary[];
  details: Map<string, PublicProjectDetail>;
  authors: Map<string, PublicAuthor>;
};

/**
 * 公開情報を一括で取り出す。
 *
 * バージョンはプロジェクトごとに引くため、件数が増えるとクエリ数も増える。
 * 日次のバッチでしか呼ばないので、まとめ読みより素直さを優先している。
 */
export async function collectSnapshotData(db: Db): Promise<SnapshotData> {
  const rows = await selectPublicProjects(db);

  const summaries: PublicProjectSummary[] = [];
  const details = new Map<string, PublicProjectDetail>();
  const authors = new Map<string, PublicAuthor>();

  for (const row of rows) {
    const summary = toSummary(row);
    summaries.push(summary);

    details.set(row.slug, {
      ...summary,
      body: row.body,
      bodyFormat: row.bodyFormat,
      license: row.license,
      sourceUrl: row.sourceUrl,
      issueTrackerUrl: row.issueTrackerUrl,
      links: row.links,
      createdAt: row.createdAt.getTime(),
      versions: await selectPublicVersions(db, row.id),
    });

    const author = authors.get(row.authorUsername) ?? {
      username: row.authorUsername,
      displayName: row.authorName || row.authorUsername,
      avatarUrl: row.authorAvatarUrl,
      projectSlugs: [],
    };
    author.projectSlugs.push(row.slug);
    authors.set(row.authorUsername, author);
  }

  return { summaries, details, authors };
}
