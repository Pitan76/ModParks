import { parseModJar } from "./parseMod";
import { extractRecipes } from "./recipeExtract";
import { uploadViaCdn, uploadDirectToR2, updateRecipeIndex } from "./recipeUpload";
import { resolveJarSource } from "./source";
import type { JarWorkerEnv } from "./env";
import type {
  ExtractRecipesRequest,
  ExtractRecipesResult,
  ParseModRequest,
  ParsedModInfo,
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
  const { source, cdnUrl, useCdnApi } = (await req.json()) as ExtractRecipesRequest;
  const arrayBuffer = await resolveJarSource(source, env);
  const { byNs, namespaces, craftingRecipes } = await extractRecipes(arrayBuffer);

  if (useCdnApi) {
    const count = await uploadViaCdn(byNs, cdnUrl, env.RECIPE_CDN_SECRET);
    return { count, namespaces };
  }

  const count = await uploadDirectToR2(byNs, env.modparks_storage);
  await updateRecipeIndex(env.modparks_storage, craftingRecipes);
  return { count, namespaces };
}

const ROUTES: Record<string, (req: Request, env: JarWorkerEnv) => Promise<unknown>> = {
  "/parse-mod": handleParseMod,
  "/extract-recipes": handleExtractRecipes,
};

export default {
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
