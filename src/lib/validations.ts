import { z } from "zod";
import { locales } from "@/lib/i18n/locales";
import { RELEASE_CHANNELS, DEFAULT_RELEASE_CHANNEL } from "@/lib/releaseChannels";
import { MC_VERSIONS, type McVersion } from "@/lib/data/minecraftVersions";
import { NEW_PROJECT_SLUG } from "@/lib/upload/fileTypes";
import { CONTENT_TYPES } from "@/lib/data/projectTypes";
import { vk } from "@/lib/validationKeys";
import { DEPENDENCY_TYPES, MAX_DEPENDENCY_DRAFTS } from "@/lib/dependencies/types";

const LICENSES = [
  "MIT",
  "MIT-0",
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
  "0BSD",
  "Proprietary",
  "All Rights Reserved",
] as const;

export type Loader = string;
export type License = (typeof LICENSES)[number];

export { MC_VERSIONS, LICENSES };
export type { McVersion };

// ---- Project Schema ----

/**
 * プロジェクト slug として使えない値。
 *
 * NEW_PROJECT_SLUG は未保存プロジェクトのアップロードキーの目印。
 * 実プロジェクトが同じ slug を取ると、アップロード経路がそのキーを
 * 「未保存プロジェクト」と誤認して所有者でも 403 になる。
 */
export const RESERVED_PROJECT_SLUGS = [NEW_PROJECT_SLUG] as const;

const projectSlugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, vk("slugFormat"))
  .refine(
    (slug) => !(RESERVED_PROJECT_SLUGS as readonly string[]).includes(slug),
    vk("slugReserved")
  );

export const createProjectSchema = z.object({
  name:        z.string().min(3, vk("nameMin")).max(64, vk("nameMax")),
  slug:        projectSlugSchema,
  description: z.string().min(10, vk("descriptionMin")).max(2000, vk("descriptionMax")),
  descriptionFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).default("markdown").optional(),
  type:        z.enum(CONTENT_TYPES),
  license:     z.string().min(1, vk("licenseRequired")).max(64, vk("licenseMax")),
  sourceUrl:   z.string().url(vk("invalidUrl")).optional().or(z.literal("")),
  links:       z.string().optional().or(z.literal("")),
  modrinthId:  z.string().optional().nullable(),
  curseforgeId: z.string().optional().nullable(),
  githubRepo:  z.string().max(140).optional().nullable(),
  discordWebhookUrl: z.string().url(vk("invalidUrl")).max(255).optional().or(z.literal("")).nullable(),
  tags:        z.array(z.string().max(32)).max(10, vk("tagsMax")),
  aiGenerated: z.boolean().default(false).optional(),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  slug: projectSlugSchema.optional(),
  issueTrackerUrl: z.string().url(vk("invalidUrl")).optional().or(z.literal("")).nullable(),
  status: z.enum(["draft", "public", "unlisted", "private"]).optional(),
  // 原文の言語。多言語表示の起点なので、作者が後から直せるようにしている
  sourceLocale: z.enum(locales as unknown as [string, ...string[]]).optional(),
  aiTranslationEnabled: z.boolean().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ---- Version Schema ----

export const createVersionSchema = z.object({
  versionNumber: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[0-9a-zA-Z.\-+]+$/, vk("versionNumberFormat")),
  // リソースパック/データパック等はローダーやMCバージョンを持たないため任意
  mcVersions: z.array(z.enum(MC_VERSIONS)).default([]),
  loaders: z.array(z.string()).default([]),
  changelog: z.string().max(10000).optional().or(z.literal("")),
  releaseChannel: z.enum(RELEASE_CHANNELS).default(DEFAULT_RELEASE_CHANNEL),
});

export type CreateVersionInput = z.infer<typeof createVersionSchema>;

/**
 * バージョン登録と同時に渡される依存関係の下書き。
 *
 * 相手はプロジェクト（スラッグ）か外部URLのどちらか。存在確認と
 * ドメイン許可の判定は保存側（resolveDependencyDrafts）で行う。
 */
export const dependencyDraftSchema = z
  .object({
    dependencyType: z.enum(DEPENDENCY_TYPES),
    targetSlug: z.string().max(120).optional(),
    externalName: z.string().max(120).optional(),
    externalUrl: z.string().url(vk("invalidUrl")).optional(),
    loaders: z.array(z.string().max(60)).max(20).default([]),
  })
  .refine(
    (d) => !!d.targetSlug?.trim() || (!!d.externalName?.trim() && !!d.externalUrl?.trim()),
    { message: vk("dependencyTargetRequired") },
  );

export const dependencyDraftsSchema = z.array(dependencyDraftSchema).max(MAX_DEPENDENCY_DRAFTS);

export type DependencyDraftInput = z.infer<typeof dependencyDraftSchema>;

export const updateVersionSchema = createVersionSchema.partial().extend({
  versionNumber: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[0-9a-zA-Z.\-+]+$/, vk("versionNumberFormat"))
    .optional(),
  mcVersions: z.array(z.enum(MC_VERSIONS)).optional(),
  loaders: z.array(z.string()).optional(),
  fileUrl: z.string().url(vk("invalidUrl")).optional(),
});

export type UpdateVersionInput = z.infer<typeof updateVersionSchema>;

// ---- External URL ----

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

// ---- Report Schema ----

export const REPORT_REASONS = ["copyright", "malware", "spam", "harassment", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const createReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  detail: z.string().max(1000).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// ---- Profile Schema ----

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64),
  bio:         z.string().max(500).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---- Idea Schema ----

export const createIdeaSchema = z.object({
  title:      z.string().min(3, vk("titleMin")).max(100, vk("titleMax")),
  content:    z.string().min(10, vk("ideaContentMin")).max(5000, vk("ideaContentMax")),
  contentFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).optional().default("markdown"),
  visibility: z.enum(["draft", "public", "unlisted", "private"]).optional().default("public"),
});

export const createIdeaCommentSchema = z.object({
  content: z.string().min(1, vk("commentMin")).max(2000, vk("commentMax")),
  contentFormat: z.enum(["markdown", "plaintext", "pukiwiki"]).optional().default("markdown"),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type CreateIdeaCommentInput = z.infer<typeof createIdeaCommentSchema>;

/**
 * メールアドレスのドメインがブロックリストに登録されているか判定する
 */
export function isBlockedEmailDomain(email: string, blockedDomainsString: string): boolean {
  if (!email || !blockedDomainsString) return false;
  try {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;

    const blockedDomains = blockedDomainsString
      .split(/[\s,]+/)
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    return blockedDomains.some(
      (d) => domain === d || domain.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}
