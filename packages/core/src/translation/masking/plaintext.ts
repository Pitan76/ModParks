/**
 * プレーンテキスト用マスカ。保護すべきは URL 程度なので、ほぼ素通しする。
 */
import { TokenBag, type FormatMasker, type MaskedDocument, type MaskedLine } from "./types";
import { maskInline, opaque, URL_PATTERN } from "./inline";

export const plaintextMasker: FormatMasker = {
  mask(text: string): MaskedDocument {
    const bag = new TokenBag();
    const lines = text.split("\n").map((raw): MaskedLine => {
      if (raw.trim() === "") return { marker: raw, text: "", translatable: false };
      return { marker: "", text: maskInline(raw, [opaque(URL_PATTERN)], bag), translatable: true };
    });
    return { lines, tokens: bag.toArray() };
  },
};
