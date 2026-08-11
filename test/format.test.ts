import { describe, expect, it } from "vitest";
import {
  formatBytes,
  toStringArray,
  formatDate,
  formatCompactNumber,
  compactMcVersions,
} from "../src/lib/utils/format";

describe("formatBytes", () => {
  it("バイト数が 1024 未満の場合は B 単位で出力されること", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("バイト数が 1024 以上 1048576 未満の場合は KB 単位で出力され、小数点第1位まで表示されること", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1047552)).toBe("1023.0 KB");
  });

  it("バイト数が 1048576 以上の場合は MB 単位で出力され、小数点第2位まで表示されること", () => {
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1572864)).toBe("1.50 MB");
    expect(formatBytes(104857600)).toBe("100.00 MB");
  });
});

describe("toStringArray", () => {
  it("入力が null または undefined の場合は空配列を返すこと", () => {
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray(undefined)).toEqual([]);
  });

  it("入力が既に配列の場合はそのまま返すこと", () => {
    const arr = ["a", "b"];
    expect(toStringArray(arr)).toBe(arr);
  });

  it("入力が有効な JSON 配列文字列の場合はパースされた配列を返すこと", () => {
    expect(toStringArray('["a", "b"]')).toEqual(["a", "b"]);
    expect(toStringArray("[]")).toEqual([]);
  });

  it("入力が空文字列の場合は空配列を返すこと", () => {
    expect(toStringArray("")).toEqual([]);
  });
});

describe("formatDate", () => {
  it("有効な Date オブジェクトが正しく YYYY/MM/DD にフォーマットされること", () => {
    expect(formatDate(new Date("2026-08-08T00:00:00Z"))).toBe("2026/08/08");
  });

  it("有効なミリ秒数値が正しく YYYY/MM/DD にフォーマットされること", () => {
    const d = new Date(1788888888000);
    const expected = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    expect(formatDate(1788888888000)).toBe(expected);
  });

  it("有効な日付文字列が正しく YYYY/MM/DD にフォーマットされること", () => {
    expect(formatDate("2026-12-31")).toBe("2026/12/31");
  });

  it("無効な日付の場合は空文字列を返すこと", () => {
    expect(formatDate("invalid-date")).toBe("");
  });
});

describe("formatCompactNumber", () => {
  describe("ja ロケール", () => {
    it("10000 未満の場合はカンマ区切りの数値として出力されること", () => {
      expect(formatCompactNumber(9999, "ja")).toBe("9,999");
      expect(formatCompactNumber(123, "ja")).toBe("123");
    });

    it("10000 以上の場合は「万」サフィックスが付与され、整数でない場合は少数第1位まで表示されること", () => {
      expect(formatCompactNumber(10000, "ja")).toBe("1\u2060万");
      expect(formatCompactNumber(15000, "ja")).toBe("1.5\u2060万");
      expect(formatCompactNumber(100000, "ja")).toBe("10\u2060万");
    });
  });

  describe("ja 以外のロケール", () => {
    it("1000 未満の場合はそのまま文字列として出力されること", () => {
      expect(formatCompactNumber(999, "en")).toBe("999");
    });

    it("1000 以上 1000000 未満の場合は K サフィックスが付与され、少数第1位まで表示されること", () => {
      expect(formatCompactNumber(1000, "en")).toBe("1.0K");
      expect(formatCompactNumber(1500, "en")).toBe("1.5K");
      expect(formatCompactNumber(99900, "en")).toBe("99.9K");
    });

    it("1000000 以上の場合は M サフィックスが付与され、少数第1位まで表示されること", () => {
      expect(formatCompactNumber(1000000, "en")).toBe("1.0M");
      expect(formatCompactNumber(2500000, "en")).toBe("2.5M");
    });
  });
});

describe("compactMcVersions", () => {
  it("引数が null, undefined、または要素数が1以下の場合はそのまま返すこと", () => {
    expect(compactMcVersions([])).toEqual([]);
    expect(compactMcVersions(["1.21"])).toEqual(["1.21"]);
  });

  /**
   * 1.20.3, 1.20.2, 1.20.1, 1.20 の4つが揃っているため 1.20.x になることを検証します。
   */
  it("同一プレフィックス of マイナーバージョンが4つ以上連続し、かつパッチ0まで連続している場合は .x にまとめられること", () => {
    expect(compactMcVersions(["1.20.3", "1.20.2", "1.20.1", "1.20"])).toEqual(["1.20.x"]);
  });

  it("同一プレフィックス of マイナーバージョンが2つ以上連続している場合は ～ で範囲表示されること", () => {
    expect(compactMcVersions(["1.20.2", "1.20.1"])).toEqual(["1.20.1～1.20.2"]);
  });

  it("パッチ数が3個のマイナーバージョン（1.18など）でも全パッチバージョンが揃っていれば .x にまとめられること", () => {
    expect(compactMcVersions(["1.18.2", "1.18.1", "1.18"])).toEqual(["1.18.x"]);
  });

  /**
   * 1.21.2, 1.21.1, 1.21 -> 1.21～1.21.2 (要素数3、かつ1.21.0(1.21)まであるが、全要素ではないため範囲表示)
   * 1.20.4, 1.20.3, 1.20.2, 1.20.1, 1.20 -> 1.20.x (全要素揃っているので 1.20.x)
   */
  it("混在している場合に正しくソート・集約が行われること", () => {
    const input = ["1.21.2", "1.21.1", "1.21", "1.20.4", "1.20.3", "1.20.2", "1.20.1", "1.20"];
    expect(compactMcVersions(input)).toEqual(["1.21～1.21.2", "1.20.x"]);
  });
});
