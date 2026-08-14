import { describe, expect, it } from "vitest";
import { getMasker, type BodyFormat } from "../src/lib/translation/masking";
import { parsePayload, toPayload, toPayloadChunks, translatableIndices } from "../src/lib/translation/payload";
import { keepValidLines, restore } from "../src/lib/translation/restore";
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
  const parsed = keepValidLines(doc, parsePayload(responded, translatableIndices(doc)));
  expect(parsed.size).toBe(translatableIndices(doc).length);
  return restore(doc, parsed);
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

  it("表のセル数が変わる訳文は採用されないこと", () => {
    const doc = getMasker("pukiwiki").mask("|A|B|");
    const broken = parsePayload(toPayload(doc).replace(/<x\d+\/>/g, ""), translatableIndices(doc));
    expect(keepValidLines(doc, broken).size).toBe(0);
  });

  it("応答が途中で切れても、返った行だけ訳文になり残りは原文が保たれること", () => {
    const doc = getMasker("pukiwiki").mask("一行目\n二行目");
    const partial = keepValidLines(doc, parsePayload("L0: first", translatableIndices(doc)));
    expect(partial.size).toBe(1);
    expect(restore(doc, partial)).toBe("first\n二行目");
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

describe("ペイロードの分割", () => {
  it("長い本文が複数の塊に分かれ、全行が過不足なく含まれること", () => {
    const body = Array.from({ length: 40 }, (_, i) => `これは${i}行目の説明文です。`.repeat(3)).join("\n");
    const doc = getMasker("markdown").mask(body);
    const chunks = toPayloadChunks(doc, 800);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flatMap((c) => c.indices)).toEqual(translatableIndices(doc));
  });

  it("短い本文は 1 つの塊に収まること", () => {
    const doc = getMasker("markdown").mask("短い説明");
    expect(toPayloadChunks(doc, 800)).toHaveLength(1);
  });
});
