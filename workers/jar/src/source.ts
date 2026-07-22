import type { JarSource } from "./types";
import type { JarWorkerEnv } from "./env";

/**
 * JarSource を実体のバイト列に解決する。
 *
 * 呼び出し元から JAR のバイト列を送らせず所在だけを受け取ることで、
 * Service Binding 越しに数十MBを二重に載せることを避けている。
 */
export async function resolveJarSource(
  source: JarSource,
  env: JarWorkerEnv
): Promise<ArrayBuffer> {
  if (source.kind === "r2") {
    const object = await env.modparks_storage.get(source.key);
    if (!object) throw new Error(`File not found in R2: ${source.key}`);
    return object.arrayBuffer();
  }

  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`Failed to download ${source.url}: ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}
