import { describe, expect, it } from "vitest";
import { getMasker, type BodyFormat } from "../src/lib/translation/masking";
import { parsePayload, toPayload } from "../src/lib/translation/payload";
import { restore, validateTokens } from "../src/lib/translation/restore";
import { detectSourceLocale } from "../src/lib/translation/detectLocale";

/** 翻訳を通さず、返ってきた体で往復させる（記法が保たれることの確認） */
function roundTrip(text: string, format: BodyFormat, translate = (s: string) => s): string {
  const doc = getMasker(format).mask(text);
  const responded = toPayload(doc)
    .split("\n")
    .map((line) => {
      const m = /^L(\d+): ([\s\S]*)$/.exec(line);
      return m ? `L${m[1]}: ${translate(m[2])}` : line;
    })
    .join("\n");
  const parsed = parsePayload(responded, doc);
  expect(parsed).not.toBeNull();
  expect(validateTokens(doc, parsed!)).toBe(true);
  return restore(doc, parsed!);
}

describe("markdown マスキング", () => {
  it("翻訳が恒等なら原文がそのまま復元されること", () => {
    const text = [
      "# 見出し",
      "",
      "- 項目1 `code` と [リンク](https://example.com)",
      "- 項目2 ![alt](https://example.com/a.png)",
      "",
      "```java",
      "System.out.println(\"訳してはいけない\");",
      "```",
      "> 引用文",
    ].join("\n");
    expect(roundTrip(text, "markdown")).toBe(text);
  });

  it("コードブロックの中身が翻訳対象に含まれないこと", () => {
    const doc = getMasker("markdown").mask("説明\n```\nlet x = 1;\n```");
    expect(toPayload(doc)).toBe("L0: 説明");
  });

  it("リンクの表示テキストだけが翻訳対象に残ること", () => {
    const doc = getMasker("markdown").mask("[ダウンロード](https://example.com/dl)");
    expect(toPayload(doc)).not.toContain("https://example.com/dl");
    expect(toPayload(doc)).toContain("ダウンロード");
  });
});

describe("pukiwiki マスキング", () => {
  it("見出し・表・リンクを含む文が復元されること", () => {
    const text = [
      "* 見出し",
      "|項目|説明|h",
      "|A|説明文|",
      "- 箇条書き [[公式サイト>https://example.com]]",
      "#ref(image.png)",
      "本文です~",
    ].join("\n");
    expect(roundTrip(text, "pukiwiki")).toBe(text);
  });

  it("表のセル数が変わる訳文は検証で弾かれること", () => {
    const doc = getMasker("pukiwiki").mask("|A|B|");
    const parsed = parsePayload(toPayload(doc).replace(/<x\d+\/>/g, ""), doc);
    expect(parsed).not.toBeNull();
    expect(validateTokens(doc, parsed!)).toBe(false);
  });

  it("行数が変わる応答は破棄されること", () => {
    const doc = getMasker("pukiwiki").mask("一行目\n二行目");
    expect(parsePayload("L0: first", doc)).toBeNull();
  });
});

describe("plaintext マスキング", () => {
  it("URL が翻訳対象から外れること", () => {
    const doc = getMasker("plaintext").mask("詳細は https://example.com を参照");
    expect(toPayload(doc)).not.toContain("example.com");
    expect(roundTrip("詳細は https://example.com を参照", "plaintext"))
      .toBe("詳細は https://example.com を参照");
  });
});

describe("原文言語の推定", () => {
  it("かなを含む本文は日本語と判定されること", () => {
    expect(detectSourceLocale("このModはカメラを追加します。")).toBe("ja");
  });

  it("英語のみの本文は英語と判定されること", () => {
    expect(detectSourceLocale("A camera mod that adds ambient shots to your world.")).toBe("en");
  });

  it("英語本文に日本語の作者名が混ざっても英語と判定されること", () => {
    expect(detectSourceLocale(
      "Ambient Camera lets you record cinematic shots. Compatible with Fabric and NeoForge. " +
      "Report issues on GitHub. Licensed under MIT."
    )).toBe("en");
  });

  it("対応していない言語と判定された場合は既定ロケールに落ちること", () => {
    expect(detectSourceLocale("这是一个相机模组")).toBe("ja");
  });

  it("空の本文は既定ロケールになること", () => {
    expect(detectSourceLocale("   ")).toBe("ja");
  });
});
