/**
 * 日本語の表記ゆらぎを吸収するための検索キーワード展開。
 *
 * 検索は D1 の `LIKE '%kw%'` で行っているため、保存側の文字列をそのまま比較する。
 * 「ひらがなで打ったらカタカナのタイトルに当たらない」「全角で打ったら半角に当たらない」
 * といった取りこぼしが起きるので、キーワードを表記バリアントに展開して OR で繋ぐ。
 *
 * 正規化カラムを別に持つ案は、マイグレーション・バックフィル・書き込み側の追従が
 * 必要になるうえ、既存データの取りこぼしを一度に直せない。
 * 対象データが小さいうちはクエリ側の展開で十分なので、こちらを採る。
 */

/** ひらがな ⇄ カタカナ のコードポイント差。「ゝ」などの繰り返し記号は対象外 */
const KANA_OFFSET = 0x60;

/** ひらがな → カタカナ */
function toKatakana(input: string): string {
  return input.replace(/[ぁ-ゖ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + KANA_OFFSET)
  );
}

/** カタカナ → ひらがな */
function toHiragana(input: string): string {
  return input.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - KANA_OFFSET)
  );
}

/** 全角カタカナ → 半角カタカナの対応。濁点・半濁点は2文字に分解される */
const HALF_WIDTH_KANA: Record<string, string> = {
  ガ: "ｶﾞ", ギ: "ｷﾞ", グ: "ｸﾞ", ゲ: "ｹﾞ", ゴ: "ｺﾞ",
  ザ: "ｻﾞ", ジ: "ｼﾞ", ズ: "ｽﾞ", ゼ: "ｾﾞ", ゾ: "ｿﾞ",
  ダ: "ﾀﾞ", ヂ: "ﾁﾞ", ヅ: "ﾂﾞ", デ: "ﾃﾞ", ド: "ﾄﾞ",
  バ: "ﾊﾞ", ビ: "ﾋﾞ", ブ: "ﾌﾞ", ベ: "ﾍﾞ", ボ: "ﾎﾞ",
  パ: "ﾊﾟ", ピ: "ﾋﾟ", プ: "ﾌﾟ", ペ: "ﾍﾟ", ポ: "ﾎﾟ",
  ヴ: "ｳﾞ",
  ア: "ｱ", イ: "ｲ", ウ: "ｳ", エ: "ｴ", オ: "ｵ",
  カ: "ｶ", キ: "ｷ", ク: "ｸ", ケ: "ｹ", コ: "ｺ",
  サ: "ｻ", シ: "ｼ", ス: "ｽ", セ: "ｾ", ソ: "ｿ",
  タ: "ﾀ", チ: "ﾁ", ツ: "ﾂ", テ: "ﾃ", ト: "ﾄ",
  ナ: "ﾅ", ニ: "ﾆ", ヌ: "ﾇ", ネ: "ﾈ", ノ: "ﾉ",
  ハ: "ﾊ", ヒ: "ﾋ", フ: "ﾌ", ヘ: "ﾍ", ホ: "ﾎ",
  マ: "ﾏ", ミ: "ﾐ", ム: "ﾑ", メ: "ﾒ", モ: "ﾓ",
  ヤ: "ﾔ", ユ: "ﾕ", ヨ: "ﾖ",
  ラ: "ﾗ", リ: "ﾘ", ル: "ﾙ", レ: "ﾚ", ロ: "ﾛ",
  ワ: "ﾜ", ヲ: "ｦ", ン: "ﾝ",
  ァ: "ｧ", ィ: "ｨ", ゥ: "ｩ", ェ: "ｪ", ォ: "ｫ",
  ッ: "ｯ", ャ: "ｬ", ュ: "ｭ", ョ: "ｮ",
  "。": "｡", "、": "､", "ー": "ｰ", "「": "｢", "」": "｣", "・": "･",
};

/** 全角カタカナ → 半角カタカナ。半角で登録されたデータに当てるために使う */
function toHalfWidthKana(input: string): string {
  return input.replace(/[ァ-ー。、「」・]/g, (ch) => HALF_WIDTH_KANA[ch] ?? ch);
}

/** 展開の上限。増やすほど1キーワードあたりの LIKE 条件が増える */
const MAX_VARIANTS = 5;

/**
 * 検索キーワードを表記バリアントに展開する。
 *
 * NFKC で半角カナ・全角英数を畳んだうえで、ひらがな／カタカナの双方向と
 * 半角カナ形を加える。返り値には必ず元のキーワードが含まれる。
 *
 * 長音のゆらぎ（クァーリー／クオーリー）はここでは吸収できない。
 * 音写の揺れであり、機械的な文字変換では扱えないため辞書が要る。
 *
 * @param keyword 利用者が入力した1語
 * @returns 重複を除いたバリアント（最大 MAX_VARIANTS 件）
 */
export function keywordVariants(keyword: string): string[] {
  if (!keyword) return [];

  const normalized = keyword.normalize("NFKC");
  const katakana = toKatakana(normalized);

  const candidates = [
    keyword,
    normalized,
    katakana,
    toHiragana(normalized),
    toHalfWidthKana(katakana),
  ];

  return [...new Set(candidates.filter(Boolean))].slice(0, MAX_VARIANTS);
}
