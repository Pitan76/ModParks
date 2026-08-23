export const CONTENT_TYPES = [
  "mod",
  "plugin",
  "resourcepack",
  "datapack",
  "shader",
  "modpack",
  /** mod 開発を支援する AI skill。配布物は skill 一式のアーカイブ */
  "skill",
  "other",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
