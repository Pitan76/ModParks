import { parseModJar } from "./parseMod";
import { scanJar } from "./scanJar";
import { extractRecipes } from "./recipeExtract";
import { uploadViaCdn, uploadDirectToR2, updateRecipeIndex } from "./recipeUpload";
import { resolveJarSource } from "./source";
import type { JarWorkerEnv } from "./env";
import type {
  ExtractRecipesRequest,
  ExtractRecipesResult,
  ParseModRequest,
  ParsedModInfo,
  ScanJarRequest,
  ScanJarResult,
  ExtractBuildInfo,
} from "./types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function handleParseMod(req: Request, env: JarWorkerEnv): Promise<ParsedModInfo> {
  const { source } = (await req.json()) as ParseModRequest;
  const arrayBuffer = await resolveJarSource(source, env);
  return parseModJar(arrayBuffer);
}

async function handleExtractRecipes(
  req: Request,
  env: JarWorkerEnv
): Promise<ExtractRecipesResult> {
  const { source, cdnUrl, useCdnApi, token, build } = (await req.json()) as ExtractRecipesRequest;
  const arrayBuffer = await resolveJarSource(source, env);
  const { byNs, namespaces, craftingRecipes } = await extractRecipes(arrayBuffer);

  if (useCdnApi) {
    const resolved = await resolveBuildInfo(arrayBuffer, build);
    const count = await uploadViaCdn(byNs, cdnUrl, env.RECIPE_CDN_SECRET, resolved, token);
    return { count, namespaces, mcVersions: resolved.mcVersions };
  }

  const count = await uploadDirectToR2(byNs, env.modparks_storage);
  await updateRecipeIndex(env.modparks_storage, craftingRecipes);
  return { count, namespaces };
}

/**
 * build の素性を決める。呼び出し側の指定を優先し、無い項目だけ JAR の宣言から補う。
 *
 * ModParks 経由では version レコードが正で、外部投稿では JAR しか手がかりが無い。
 * 両方を同じ経路に載せるため、ここで一度だけ突き合わせる。
 */
async function resolveBuildInfo(
  arrayBuffer: ArrayBuffer,
  requested: ExtractBuildInfo | undefined
): Promise<ExtractBuildInfo> {
  if (requested?.mcVersions?.length && requested.modVersion) return requested;

  const parsed = await parseModJar(arrayBuffer).catch(() => null);
  return {
    mcVersions: requested?.mcVersions?.length ? requested.mcVersions : parsed?.detectedMcVersions ?? [],
    modVersion: requested?.modVersion ?? parsed?.detectedVersion ?? null,
    loader: requested?.loader ?? parsed?.detectedLoaders?.[0] ?? null,
  };
}

async function handleScanJar(req: Request, env: JarWorkerEnv): Promise<ScanJarResult> {
  const { source } = (await req.json()) as ScanJarRequest;
  const arrayBuffer = await resolveJarSource(source, env);
  return scanJar(arrayBuffer);
}

/**
 * @param req リクエストオブジェクト
 * @param env 環境変数
 * @returns 抽出結果
 */
async function handleExtractRecipesBinary(
  req: Request,
  env: JarWorkerEnv
): Promise<ExtractRecipesResult> {
  const cdnUrl = req.headers.get("X-CDN-Url");
  if (!cdnUrl) throw new Error("Missing X-CDN-Url header");

  const useCdnApi = req.headers.get("X-Use-CDN-Api") === "true";
  const token = req.headers.get("X-Token") || undefined;
  const buildHeader = req.headers.get("X-Build");
  const build = buildHeader ? JSON.parse(buildHeader) : undefined;

  const arrayBuffer = await req.arrayBuffer();
  const { byNs, namespaces, craftingRecipes } = await extractRecipes(arrayBuffer);

  if (useCdnApi) {
    const resolved = await resolveBuildInfo(arrayBuffer, build);
    const count = await uploadViaCdn(byNs, cdnUrl, env.RECIPE_CDN_SECRET, resolved, token);
    return { count, namespaces, mcVersions: resolved.mcVersions };
  }

  const count = await uploadDirectToR2(byNs, env.modparks_storage);
  await updateRecipeIndex(env.modparks_storage, craftingRecipes);
  return { count, namespaces };
}

const ROUTES: Record<string, (req: Request, env: JarWorkerEnv) => Promise<unknown>> = {
  "/parse-mod": handleParseMod,
  "/extract-recipes": handleExtractRecipes,
  "/extract-recipes-binary": handleExtractRecipesBinary,
  "/scan-jar": handleScanJar,
};

const worker = {
  async fetch(req: Request, env: JarWorkerEnv): Promise<Response> {
    const handler = ROUTES[new URL(req.url).pathname];
    if (!handler) return json({ error: "Not found" }, 404);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      return json(await handler(req, env));
    } catch (e) {
      console.error("jar worker failed:", e);
      return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
    }
  },
};

export default worker;
