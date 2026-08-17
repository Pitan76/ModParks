import { describe, expect, it } from "vitest";
import { FormReader, CHECKBOX_ABSENT_VALUE } from "@/lib/forms/formReader";
import { buildProjectCreateInput, buildProjectUpdateInput } from "@/lib/forms/projectFormInput";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations";

/** スイッチ（hidden + checkbox）の送信内容を再現する */
const appendSwitch = (fd: FormData, name: string, checked: boolean) => {
  fd.append(name, CHECKBOX_ABSENT_VALUE);
  if (checked) fd.append(name, "on");
};

/** 基本情報タブが実際に送る内容。説明は別タブなので含まれない */
const basicInfoFormData = (overrides: Record<string, string> = {}) => {
  const fd = new FormData();
  const fields: Record<string, string> = {
    name: "My Mod",
    slug: "my-mod",
    type: "mod",
    license: "MIT",
    sourceUrl: "",
    issueTrackerUrl: "",
    modrinthId: "",
    curseforgeId: "",
    githubRepo: "",
    discordWebhookUrl: "",
    githubReleaseImportMode: "link",
    links: "[]",
    status: "public",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  appendSwitch(fd, "aiGenerated", false);
  appendSwitch(fd, "commentsEnabled", true);
  appendSwitch(fd, "recipesEnabled", false);
  return fd;
};

describe("FormReader", () => {
  it("未送信は undefined（部分更新で触らない）", () => {
    const form = new FormReader(new FormData());
    expect(form.text("name")).toBeUndefined();
    expect(form.nullableText("modrinthId")).toBeUndefined();
    expect(form.list("tags")).toBeUndefined();
    expect(form.checkbox("aiGenerated")).toBeUndefined();
  });

  it("空文字で送られた項目は「クリア」として null になる", () => {
    const fd = new FormData();
    fd.append("modrinthId", "");
    expect(new FormReader(fd).nullableText("modrinthId")).toBeNull();
  });

  it("空文字と未送信を取り違えない", () => {
    const fd = new FormData();
    fd.append("sourceUrl", "");
    expect(new FormReader(fd).text("sourceUrl")).toBe("");
    expect(new FormReader(new FormData()).text("sourceUrl")).toBeUndefined();
  });

  it("スイッチはオフでも「送信された」ことが伝わる", () => {
    const off = new FormData();
    appendSwitch(off, "commentsEnabled", false);
    expect(new FormReader(off).checkbox("commentsEnabled")).toBe(false);

    const on = new FormData();
    appendSwitch(on, "commentsEnabled", true);
    expect(new FormReader(on).checkbox("commentsEnabled")).toBe(true);
  });

  it("タグは送信されていれば空配列（＝全解除）として届く", () => {
    const fd = new FormData();
    fd.append("tags", "");
    expect(new FormReader(fd).list("tags")).toEqual([""]);
    expect(new FormReader(new FormData()).list("tags")).toBeUndefined();
  });
});

describe("buildProjectUpdateInput", () => {
  it("説明を持たない基本情報タブからでも検証を通る（保存が無反応になる不具合の回帰）", () => {
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(basicInfoFormData()));
    expect(parsed.success).toBe(true);
  });

  it("送っていない項目は更新対象に含まれない", () => {
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(basicInfoFormData()));
    if (!parsed.success) throw new Error("検証に失敗した");

    // undefined の項目は保存時に set から外れる＝既存値が保たれる
    expect(parsed.data.description).toBeUndefined();
    expect(parsed.data.descriptionFormat).toBeUndefined();
    expect(parsed.data.sourceLocale).toBeUndefined();
    expect(parsed.data.tags).toBeUndefined();
  });

  it("送った項目はそのまま更新対象になる", () => {
    const fd = basicInfoFormData({ name: "Renamed", status: "private" });
    fd.append("tags", "tech");
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(fd));
    if (!parsed.success) throw new Error("検証に失敗した");

    expect(parsed.data.name).toBe("Renamed");
    expect(parsed.data.status).toBe("private");
    expect(parsed.data.tags).toEqual(["tech"]);
  });

  it("空欄で送られた外部IDは null（クリア）になる", () => {
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(basicInfoFormData()));
    if (!parsed.success) throw new Error("検証に失敗した");

    expect(parsed.data.modrinthId).toBeNull();
    expect(parsed.data.curseforgeId).toBeNull();
  });

  it("不正な入力はきちんと弾く", () => {
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(basicInfoFormData({ slug: "AB" })));
    expect(parsed.success).toBe(false);
  });

  it("説明タブから送れば説明が更新対象になる", () => {
    const fd = basicInfoFormData();
    fd.set("description", "これは十分な長さの説明文です。");
    fd.set("descriptionFormat", "markdown");
    const parsed = updateProjectSchema.safeParse(buildProjectUpdateInput(fd));
    if (!parsed.success) throw new Error("検証に失敗した");

    expect(parsed.data.description).toBe("これは十分な長さの説明文です。");
    expect(parsed.data.descriptionFormat).toBe("markdown");
  });
});

describe("buildProjectCreateInput", () => {
  it("作成フォームの必須項目が揃っていれば通る", () => {
    const fd = basicInfoFormData();
    fd.set("description", "これは十分な長さの説明文です。");
    fd.append("tags", "tech");
    const parsed = createProjectSchema.safeParse(buildProjectCreateInput(fd));
    expect(parsed.success).toBe(true);
  });

  it("説明が無ければ作成は弾かれる", () => {
    const parsed = createProjectSchema.safeParse(buildProjectCreateInput(basicInfoFormData()));
    expect(parsed.success).toBe(false);
  });

  it("hidden を添えたスイッチでも on/off を取り違えない", () => {
    const fd = basicInfoFormData();
    fd.set("description", "これは十分な長さの説明文です。");
    expect(buildProjectCreateInput(fd).aiGenerated).toBe(false);

    const fd2 = basicInfoFormData();
    fd2.set("description", "これは十分な長さの説明文です。");
    fd2.append("aiGenerated", "on");
    expect(buildProjectCreateInput(fd2).aiGenerated).toBe(true);
  });
});
