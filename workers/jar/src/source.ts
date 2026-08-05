import type { JarSource } from "./types";
import type { JarWorkerEnv } from "./env";
import { assertInputSize, InputTooLargeError, MAX_INPUT_BYTES } from "./limits";

/**
 * 応答本文を上限まで読み、超えたら打ち切る。
 *
 * Content-Length は外部サーバの申告値でしかなく、実際にはそれ以上流れて
 * くることがある。読みながら測らないと上限の意味が無い。
 */
async function readCapped(res: Response): Promise<ArrayBuffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 0) assertInputSize(declared);

  const reader = res.body?.getReader();
  if (!reader) return res.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.length;
    if (total > MAX_INPUT_BYTES) {
      await reader.cancel();
      throw new InputTooLargeError(`Response exceeded ${MAX_INPUT_BYTES} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

/**
 * JarSource を実体のバイト列に解決する。
 *
 * 呼び出し元から JAR のバイト列を送らせず所在だけを受け取ることで、
 * Service Binding 越しに数十MBを二重に載せることを避けている。
 *
 * @throws InputTooLargeError 上限を超える入力
 */
export async function resolveJarSource(
  source: JarSource,
  env: JarWorkerEnv
): Promise<ArrayBuffer> {
  if (source.kind === "r2") {
    const object = await env.modparks_storage.get(source.key);
    if (!object) throw new Error(`File not found in R2: ${source.key}`);

    // R2 のサイズは信頼できるため、読み込む前に弾ける
    assertInputSize(object.size);
    return object.arrayBuffer();
  }

  const res = await fetch(source.url);
  if (!res.ok) throw new Error(`Failed to download ${source.url}: ${res.status} ${res.statusText}`);

  return readCapped(res);
}
