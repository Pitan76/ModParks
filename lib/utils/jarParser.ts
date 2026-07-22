import { resizeImageFile } from "./image";
import { uploadFileToR2 } from "./upload";

export type ParsedModData = {
  name: string;
  slug: string;
  description: string;
  license?: string;
  sourceUrl?: string;
  issueTrackerUrl?: string;
  iconUrl?: string;
  modrinthId?: string;
  curseforgeId?: string;
  externalDownloads?: string;
};

/**
 * JARファイル（Minecraft Modのアーカイブ）を解析し、プロジェクトに必要な基本メタデータを抽出します。
 * @param file 解析対象のJAR/ZIPファイル
 * @param fetchErrorMsg 解析エラー時のデフォルトメッセージ
 * @returns 抽出されたModデータ、見つからない場合はnull
 */
export const parseJarFile = async (
  file: File,
  fetchErrorMsg: string
): Promise<ParsedModData | null> => {
  const JSZip = (await import("jszip")).default;
  const { parse } = await import("smol-toml");

  const zip = new JSZip();
  await zip.loadAsync(file);

  let foundData: Partial<ParsedModData> | null = null;
  let iconPath: string | null = null;

  // 1. Try fabric.mod.json
  const fabricFile = zip.file("fabric.mod.json");
  if (fabricFile) {
    const content = await fabricFile.async("string");
    const json = JSON.parse(content);
    foundData = {
      name: json.name || json.id,
      slug: json.id,
      description: json.description || "",
      license: typeof json.license === "string" ? json.license : (json.license?.[0] || "MIT"),
      sourceUrl: json.contact?.sources || json.contact?.repo || "",
      issueTrackerUrl: json.contact?.issues || "",
    };
    if (json.icon) {
      if (typeof json.icon === "string") iconPath = json.icon;
      else if (typeof json.icon === "object") {
        const keys = Object.keys(json.icon);
        if (keys.length > 0) iconPath = json.icon[keys[keys.length - 1]];
      }
    }
  }
  // 2. Try META-INF/mods.toml or META-INF/neoforge.mods.toml
  else {
    const tomlFile = zip.file("META-INF/mods.toml") || zip.file("META-INF/neoforge.mods.toml");
    if (tomlFile) {
      const content = await tomlFile.async("string");
      const toml = parse(content) as any;
      const mod = toml.mods?.[0];
      if (mod) {
        foundData = {
          name: mod.displayName || mod.modId,
          slug: mod.modId,
          description: mod.description || "",
          license: mod.license || "All Rights Reserved",
          issueTrackerUrl: mod.issueTrackerURL || "",
        };
        if (mod.logoFile) iconPath = mod.logoFile;
      }
    }
    // 3. Try mcmod.info
    else {
      const mcmodFile = zip.file("mcmod.info");
      if (mcmodFile) {
        const content = await mcmodFile.async("string");
        try {
          let json = JSON.parse(content);
          if (json.modList) json = json.modList;
          const mod = Array.isArray(json) ? json[0] : json;
          if (mod) {
            foundData = {
              name: mod.name || mod.modid,
              slug: mod.modid,
              description: mod.description || "",
              sourceUrl: mod.url || "",
            };
            if (mod.logoFile) iconPath = mod.logoFile;
          }
        } catch (e) {
          console.warn("Invalid mcmod.info JSON", e);
        }
      }
    }
  }

  if (!foundData) return null;

  if (foundData.description) {
    foundData.description = foundData.description.replace(/^\s+|\s+$/g, "");
  }
  if (foundData.slug) {
    foundData.slug = foundData.slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  }

  if (iconPath) {
    iconPath = iconPath.replace(/^\//, "");
    const iconFileObj = zip.file(iconPath);
    if (iconFileObj) {
      try {
        const blob = await iconFileObj.async("blob");
        const ext = iconPath.split(".").pop()?.toLowerCase();
        let mimeType = "image/png";
        if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
        else if (ext === "webp") mimeType = "image/webp";
        else if (ext === "gif") mimeType = "image/gif";
        
        const iconFile = new File([blob], iconPath.split("/").pop() || "icon.png", { type: mimeType });
        const resizedFile = await resizeImageFile(iconFile, 400, 400);
        const { publicUrl } = await uploadFileToR2(resizedFile, {
          type: "icon",
          projectSlug: "new-project",
        }, { presignError: "Upload error", uploadError: "Upload error" });
        
        foundData.iconUrl = publicUrl;
      } catch (e) {
        console.warn("Failed to upload icon from jar", e);
      }
    }
  }

  return foundData as ParsedModData;
};
