import { describe, expect, it } from "vitest";
import { keywordVariants } from "@/lib/search/kana";

describe("keywordVariants", () => {
  it("元のキーワードを必ず含む", () => {
    expect(keywordVariants("チェスト")).toContain("チェスト");
  });

  it("ひらがな入力からカタカナ表記を引ける", () => {
    expect(keywordVariants("ちぇすと")).toContain("チェスト");
  });

  it("カタカナ入力からひらがな表記を引ける", () => {
    expect(keywordVariants("チェスト")).toContain("ちぇすと");
  });

  it("半角カナ入力を全角カナへ畳む", () => {
    expect(keywordVariants("ﾁｪｽﾄ")).toContain("チェスト");
  });

  it("全角カナ入力から半角カナ表記を引ける", () => {
    expect(keywordVariants("チェスト")).toContain("ﾁｪｽﾄ");
  });

  it("濁点つきの半角カナを2文字に分解する", () => {
    expect(keywordVariants("バケツ")).toContain("ﾊﾞｹﾂ");
  });

  it("全角英数を半角へ畳む", () => {
    expect(keywordVariants("ＭｏｄＰａｒｋｓ")).toContain("ModParks");
  });

  it("空文字は展開しない", () => {
    expect(keywordVariants("")).toEqual([]);
  });

  it("英字のみなら重複を除いて1件に収まる", () => {
    expect(keywordVariants("quarry")).toEqual(["quarry"]);
  });

  it("展開数は上限を超えない", () => {
    expect(keywordVariants("クァーリー").length).toBeLessThanOrEqual(5);
  });

  it("漢字は変換されずそのまま残る", () => {
    expect(keywordVariants("鉱山")).toEqual(["鉱山"]);
  });
});
