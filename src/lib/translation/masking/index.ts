/**
 * 書式ごとのマスカの入口。
 */
import type { FormatMasker } from "./types";
import { markdownMasker } from "./markdown";
import { plaintextMasker } from "./plaintext";
import { pukiwikiMasker } from "./pukiwiki";

export type BodyFormat = "markdown" | "plaintext" | "pukiwiki";

const MASKERS: Record<BodyFormat, FormatMasker> = {
  markdown:  markdownMasker,
  plaintext: plaintextMasker,
  pukiwiki:  pukiwikiMasker,
};

export const getMasker = (format: BodyFormat): FormatMasker => MASKERS[format];

export * from "./types";
