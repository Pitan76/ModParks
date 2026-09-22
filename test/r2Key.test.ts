import { describe, expect, it } from "vitest";
import { r2KeyFromUrl, r2PublicUrl } from "@modparks/core/r2";

const PUBLIC = "https://files.modparks.pitan76.net";

describe("r2KeyFromUrl", () => {
  it("公開URLの下ならキーを返す", () => {
    expect(r2KeyFromUrl(PUBLIC, `${PUBLIC}/mod/p1/123/a.jar`)).toBe("mod/p1/123/a.jar");
  });

  it("ローカルのプロキシ経由のパスからもキーを返す", () => {
    expect(r2KeyFromUrl(undefined, "/api/r2/icon/p1/1/x.png")).toBe("icon/p1/1/x.png");
  });

  it("公開URLが取れない環境でも、R2 のキー接頭辞で始まるパスならキーとみなす", () => {
    expect(r2KeyFromUrl(undefined, "https://files.modparks.pitan76.net/media/p1/1/y.webp")).toBe("media/p1/1/y.webp");
  });

  it("外部サイトのファイルは R2 管理外なので null（削除してはいけない）", () => {
    expect(r2KeyFromUrl(PUBLIC, "https://github.com/owner/repo/releases/download/v1/a.jar")).toBeNull();
    expect(r2KeyFromUrl(PUBLIC, "https://cdn.modrinth.com/data/abc/versions/1/a.jar")).toBeNull();
  });

  it("壊れた URL は例外にせず null", () => {
    expect(r2KeyFromUrl(PUBLIC, "http://")).toBeNull();
  });
});

describe("r2PublicUrl", () => {
  it("公開URLがあればその下を返す", () => {
    expect(r2PublicUrl(PUBLIC, "mod/a.jar")).toBe(`${PUBLIC}/mod/a.jar`);
  });

  it("公開URLが無ければローカルのプロキシ経由", () => {
    expect(r2PublicUrl(undefined, "mod/a.jar")).toBe("/api/r2/mod/a.jar");
  });
});
