import { describe, expect, it } from "vitest";
import { notificationMessage } from "../workers/api/src/notificationMessage";
import ja from "../src/lang/ja_jp.json";
import en from "../src/lang/en_us.json";

const payload = {
  actorName: "Alice",
  authorName: "Bob",
  title: "My Mod",
  collectionName: "Favs",
  versionNumber: "1.2.0",
  projectName: "My Mod",
  statusLabel: "clean",
  reviewNote: "ok",
};

describe("notificationMessage（modparks-api の Discord 文言）", () => {
  it.each(Object.keys(ja.Notifications.message))("%s: 変数がすべて差し込まれ、{} が残らない", async (type) => {
    for (const locale of ["ja", "en"] as const) {
      const text = await notificationMessage(locale, type as never, payload as never);

      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[{}]/);
    }
  });

  it("日英で別の文言を返す", async () => {
    const jaText = await notificationMessage("ja", "comment", payload as never);
    const enText = await notificationMessage("en", "comment", payload as never);

    expect(jaText).toBe(ja.Notifications.message.comment.replace("{actorName}", "Alice").replace("{title}", "My Mod"));
    expect(enText).toBe(en.Notifications.message.comment.replace("{actorName}", "Alice").replace("{title}", "My Mod"));
  });
});
