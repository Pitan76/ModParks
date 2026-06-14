import { z } from "zod";

const LOADERS = [
  "fabric",
  "forge",
  "neoforge",
  "quilt",
  "paper",
  "spigot",
  "bukkit",
  "purpur",
  "velocity",
  "waterfall",
] as const;

const MC_VERSIONS = [
  "26.1.2", "26.1.1", "26.1",
  "1.21.11", "1.21.10", "1.21.9", "1.21.8", "1.21.7", "1.21.6",
  "1.21.5", "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19.1", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.17",
  "1.16.5", "1.16.4", "1.16.3", "1.16.2", "1.16.1", "1.16",
  "1.15.2", "1.15.1", "1.15",
  "1.14.4", "1.14.3", "1.14.2", "1.14.1", "1.14",
  "1.13.2", "1.13.1", "1.13",
  "1.12.2", "1.12.1", "1.12",
  "1.11.4", "1.11.3", "1.11.2", "1.11.1", "1.11",
  "1.10.2", "1.10.1", "1.10",
  "1.9.4", "1.9.3", "1.9.2", "1.9.1", "1.9",
  "1.8.9", "1.8.8", "1.8.7", "1.8.6", "1.8.5", "1.8.4", "1.8.3", "1.8.2", "1.8.1", "1.8",
  "1.7.10", "1.7.2", "1.7.3", "1.7.4", "1.7.5", "1.7.6", "1.7.7", "1.7.8", "1.7.9",
  "1.6.4", "1.6.2", "1.6.3", "1.6.1", "1.6",
  "1.5.1", "1.5",
  "1.4.7", "1.4.6", "1.4.5", "1.4.4", "1.4.3", "1.4.2", "1.4.1", "1.4",
  "1.3.2", "1.3.1", "1.3",
  "1.2.5", "1.2.4", "1.2.3", "1.2.2", "1.2.1", "1.2",
  "1.1.2", "1.1",
  "1.0.1", "1.0",
  "Beta 1.8.1", "Beta 1.8", "Beta 1.7.3", "Beta 1.7", "Beta 1.6.6", "Beta 1.6.4"
] as const;

const LICENSES = [
  "MIT",
  "Apache-2.0",
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "MPL-2.0",
  "AGPL-3.0",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "Unlicense",
  "Proprietary",
] as const;

export const CONTENT_TYPES = ["mod", "plugin"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type Loader = (typeof LOADERS)[number];
export type McVersion = (typeof MC_VERSIONS)[number];
export type License = (typeof LICENSES)[number];

export { LOADERS, MC_VERSIONS, LICENSES };

// ─── Project Schema ────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name:        z.string().min(3, "3文字以上").max(64, "64文字以内"),
  slug:        z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "小文字英数字とハイフンのみ"),
  description: z.string().min(10, "10文字以上").max(2000, "2000文字以内"),
  type:        z.enum(CONTENT_TYPES),
  license:     z.enum(LICENSES),
  sourceUrl:   z.string().url("有効なURLを入力してください").optional().or(z.literal("")),
  tags:        z.array(z.string().max(32)).max(10, "タグは10個まで"),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.enum(["draft", "public", "unlisted", "private"]).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ─── Version Schema ────────────────────────────────────────────────────────────

export const createVersionSchema = z.object({
  versionNumber: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[0-9a-zA-Z.\-+]+$/, "バージョン番号の形式が不正です"),
  mcVersions: z
    .array(z.enum(MC_VERSIONS))
    .min(1, "Minecraftバージョンを1つ以上選択してください"),
  loaders: z
    .array(z.enum(LOADERS))
    .min(1, "ローダーを1つ以上選択してください"),
  changelog: z.string().min(1, "更新内容を入力してください").max(10000),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

// ─── External URL ──────────────────────────────────────────────────────────────

/** 外部URLとして許可するドメインのリスト */
export const ALLOWED_EXTERNAL_DOMAINS = [
  "github.com",
  "modrinth.com",
  "curseforge.com",
  "cdn.modrinth.com",
  "mediafilez.forgecdn.net",
  "edge.forgecdn.net",
] as const;

/**
 * 外部URLが許可されたドメインのものかチェックする
 */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_EXTERNAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// ─── Report Schema ─────────────────────────────────────────────────────────────

export const REPORT_REASONS = ["copyright", "malware", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const createReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  detail: z.string().max(1000).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// ─── Profile Schema ─────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64),
  bio:         z.string().max(500).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Idea Schema ─────────────────────────────────────────────────────────────

export const createIdeaSchema = z.object({
  title:   z.string().min(3, "3文字以上").max(100, "100文字以内"),
  content: z.string().min(10, "10文字以上").max(5000, "5000文字以内"),
});

export const createIdeaCommentSchema = z.object({
  content: z.string().min(1, "1文字以上入力してください").max(2000, "2000文字以内"),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type CreateIdeaCommentInput = z.infer<typeof createIdeaCommentSchema>;
