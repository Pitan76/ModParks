/**
 * 原文の言語判定。
 *
 * UI のロケールは当てにならない（日本語UIの作者が英語で説明を書くことがある）ため、
 * 本文の文字種から推定する。誤ることはあるので、編集画面の「原文の言語」で
 * 作者が上書きできることが前提の、あくまで初期値の決め方。
 */
import { locales, defaultLocale, type AppLocale } from "@/lib/i18n/locales";

/**
 * 文字種ごとの判定順。上から順に見て、最初に閾値を超えたものを採る。
 * かな → ハングル → 漢字 の順なのは、日本語の本文に漢字が含まれるため。
 * 漢字だけの本文は中国語とみなす。
 */
const SIGNATURES: { locale: string; pattern: RegExp }[] = [
  // 範囲の両端はブロックの端の実文字なので、見慣れない字が並ぶが文字化けではない
  { locale: "ja",    pattern: /[぀-ヿ]/g }, // ひらがな・カタカナ  U+3040-U+30FF
  { locale: "ko",    pattern: /[가-힯]/g }, // ハングル音節        U+AC00-U+D7AF
  { locale: "cn-zh", pattern: /[一-鿿]/g }, // CJK 統合漢字        U+4E00-U+9FFF
  { locale: "en",    pattern: /[A-Za-z]/g },
];

/** この割合を超える文字種をその言語とみなす */
const RATIO_THRESHOLD = 0.05;

/** 長文全体を数える必要は無いので、先頭だけを見る */
const SAMPLE_LENGTH = 2000;

/**
 * 本文から原文の言語を推定する。
 * 対応ロケールに無い言語と判定した場合は既定ロケールを返す。
 */
export function detectSourceLocale(text: string): AppLocale {
  const sample = text.slice(0, SAMPLE_LENGTH);
  const total = sample.replace(/\s/g, "").length;
  if (total === 0) return defaultLocale;

  const detected = SIGNATURES.find(({ pattern }) => ratio(sample, pattern) > RATIO_THRESHOLD);
  if (!detected) return defaultLocale;
  return locales.includes(detected.locale as AppLocale) ? (detected.locale as AppLocale) : defaultLocale;
}

const ratio = (text: string, pattern: RegExp): number =>
  (text.match(pattern) ?? []).length / text.replace(/\s/g, "").length;
