import type { ProjectCardProps } from "@/components/project/ProjectCard";

export type ProjectCardData = ProjectCardProps["project"];

/**
 * 一覧クエリの行から、カードが実際に読む列だけを取り出す。
 *
 * 一覧クエリは posts / projects の全列を返すため、行をそのままクライアント
 * コンポーネントへ渡すと RSC ペイロードに未使用の列が丸ごと乗る。
 * 転送量だけでなく、公開範囲や Webhook URL のような表示しない値まで
 * 閲覧者の手元へ届いてしまうため、境界では必ずここを通すこと。
 */
export const toProjectCardData = (project: ProjectCardData): ProjectCardData => ({
  id:                project.id,
  slug:              project.slug,
  title:             project.title,
  body:              project.body,
  iconUrl:           project.iconUrl,
  type:              project.type,
  license:           project.license,
  downloads:         project.downloads,
  totalDownloads:    project.totalDownloads,
  externalDownloads: project.externalDownloads,
  modrinthId:        project.modrinthId,
  curseforgeId:      project.curseforgeId,
  tags:              project.tags,
  authorUsername:    project.authorUsername,
  authorDisplayName: project.authorDisplayName,
  authorAvatarUrl:   project.authorAvatarUrl,
  updatedAt:         project.updatedAt,
  aiGenerated:       project.aiGenerated,
});
