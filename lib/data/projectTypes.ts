export const CONTENT_TYPES = [
  "mod",
  "plugin",
  "resourcepack",
  "datapack",
  "shader",
  "modpack",
  "other",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
