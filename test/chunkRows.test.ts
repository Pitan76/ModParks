import { describe, expect, it } from "vitest";
import { chunkRows, D1_MAX_BOUND_PARAMS } from "@/lib/db/chunkRows";

/** 分割後のどの文もパラメータ上限を超えないこと */
const withinLimit = (chunks: unknown[][], columnsPerRow: number) =>
  chunks.every((chunk) => chunk.length * columnsPerRow <= D1_MAX_BOUND_PARAMS);

describe("chunkRows", () => {
  it("上限に収まる行数はそのまま1文", () => {
    expect(chunkRows(Array.from({ length: 50 }, (_, i) => i), 2)).toHaveLength(1);
  });

  it("2列なら51行で分割される（GitHub取り込みが落ちていた条件）", () => {
    const chunks = chunkRows(Array.from({ length: 51 }, (_, i) => i), 2);
    expect(chunks).toHaveLength(2);
    expect(withinLimit(chunks, 2)).toBe(true);
  });

  it("MC_VERSIONS 全件（108）でも各文が上限内に収まる", () => {
    const chunks = chunkRows(Array.from({ length: 108 }, (_, i) => i), 2);
    expect(withinLimit(chunks, 2)).toBe(true);
  });

  it("列数が多いほど1文の行数が減る", () => {
    expect(chunkRows(Array.from({ length: 30 }, (_, i) => i), 9)[0]).toHaveLength(11);
    expect(withinLimit(chunkRows(Array.from({ length: 30 }, (_, i) => i), 9), 9)).toBe(true);
  });

  it("全要素が順序どおり保たれる（落とさない・重複させない）", () => {
    const rows = Array.from({ length: 137 }, (_, i) => i);
    expect(chunkRows(rows, 2).flat()).toEqual(rows);
  });

  it("空配列は空（挿入文を作らせない）", () => {
    expect(chunkRows([], 2)).toEqual([]);
  });

  it("列数が上限を超えても1行ずつには分ける", () => {
    expect(chunkRows([1, 2], 150)).toEqual([[1], [2]]);
  });

  it("列数が不正なら例外", () => {
    expect(() => chunkRows([1], 0)).toThrow();
  });
});
