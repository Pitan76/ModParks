/**
 * D1 は 1 クエリあたりのバインドパラメータを 100 個までしか受け付けない。
 * 複数行 INSERT は 行数 × 列数 のパラメータを使うため、行数が増えると
 * "too many SQL variables" で文ごと失敗する（batch 全体が巻き添えになる）。
 */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * 1 文あたりのパラメータ数が上限を超えないよう、行を分割する。
 *
 * @param rows 挿入する行
 * @param columnsPerRow 1 行が使うバインドパラメータ数（＝列数）
 * @returns 分割後の行グループ。空入力なら空配列
 */
export function chunkRows<T>(rows: T[], columnsPerRow: number): T[][] {
  if (columnsPerRow <= 0) throw new Error("columnsPerRow must be positive");
  if (rows.length === 0) return [];

  const maxRows = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnsPerRow));
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += maxRows) chunks.push(rows.slice(i, i + maxRows));
  return chunks;
}
