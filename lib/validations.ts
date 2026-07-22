import { z } from "zod";
import { RELEASE_CHANNELS, DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import { MC_VERSIONS, type McVersion } from "@/lib/data/minecraftVersions";

const LICENSES = [
  "MIT",
  "Apache-2.0",
  "GPL-2.0-only",
  "GPL-2.0-or-later",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "LGPL-2.1-only",
  "LGPL-2.1-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "MPL-2.0",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "CC-BY-ND-4.0",
  "WTFPL",
  "Unlicense",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Proprietary",
  "All Rights Reserved",
] as const;

export const CONTENT_TYPES = ["mod", "plugin"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export type Loader = string;
export type License = (typeof LICENSES)[number];

export { MC_VERSIONS, LICENSES };
export type { McVersion };

// ─── Project Schema ────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name:        z.string().min(3, "3文字以上").max(64, "64文字以内"),
  slug:        z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "小文字英数字とハイフンのみ"),
  description: z.string().min(10, "10文字以上").max(2000, "2000文字以内"),
  descriptionFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).default("markdown").optional(),
  type:        z.enum(CONTENT_TYPES),
  license:     z.string().min(1, "ライセンスを入力してください").max(64, "64文字以内"),
  sourceUrl:   z.string().url("有効なURLを入力してください").optional().or(z.literal("")),
  links:       z.string().optional().or(z.literal("")),
  modrinthId:  z.string().optional().nullable(),
  curseforgeId: z.string().optional().nullable(),
  githubRepo:  z.string().max(140).optional().nullable(),
  discordWebhookUrl: z.string().url("有効なURLを入力してください").max(255).optional().or(z.literal("")).nullable(),
  tags:        z.array(z.string().max(32)).max(10, "タグは10個まで"),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "小文字英数字とハイフンのみ")
    .optional(),
  issueTrackerUrl: z.string().url("有効なURLを入力してください").optional().or(z.literal("")).nullable(),
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
    .array(z.string())
    .min(1, "ローダーを1つ以上選択してください"),
  changelog: z.string().max(10000).optional().or(z.literal("")),
  releaseChannel: z.enum(RELEASE_CHANNELS).default(DEFAULT_RELEASE_CHANNEL),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

export const updateVersionSchema = createVersionSchema.partial().extend({
  versionNumber: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[0-9a-zA-Z.\-+]+$/, "バージョン番号の形式が不正です")
    .optional(),
  mcVersions: z
    .array(z.enum(MC_VERSIONS))
    .min(1, "Minecraftバージョンを1つ以上選択してください")
    .optional(),
  loaders: z
    .array(z.string())
    .min(1, "ローダーを1つ以上選択してください")
    .optional(),
  fileUrl: z.string().url("有効なURLを入力してください").optional(),
});

export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;

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
  title:      z.string().min(3, "3文字以上").max(100, "100文字以内"),
  content:    z.string().min(10, "10文字以上").max(5000, "5000文字以内"),
  contentFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).optional().default("markdown"),
  visibility: z.enum(["draft", "public", "unlisted", "private"]).optional().default("public"),
});

export const createIdeaCommentSchema = z.object({
  content: z.string().min(1, "1文字以上入力してください").max(2000, "2000文字以内"),
  contentFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).optional().default("markdown"),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type CreateIdeaCommentInput = z.infer<typeof createIdeaCommentSchema>;
