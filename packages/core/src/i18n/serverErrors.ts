/**
 * Server Action / API から返すエラー文言の翻訳関数。
 *
 * エラー文言には 2 系統あり、ここは「翻訳済みの文字列を返す」側。
 * 受け側ごとに解決方法がばらつくため、キーのまま返してはいけない。
 * （zod のバリデーション文言はキーを埋め込んで表示側で翻訳する、別の系統）
 *
 * core は翻訳の手段を持たないので受け取る。Next は next-intl の
 * getTranslations("ServerErrors") を、modparks-api は lang/*.json の
 * ServerErrors だけを取り込んだものを渡す。
 * @param key ServerErrors ネームスペース内のキー（例: "project.slugTaken"）
 */
export type ServerErrorTranslator = (key: string) => string;
