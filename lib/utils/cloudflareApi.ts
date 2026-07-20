/**
 * Cloudflare Workers のシークレット (secret_text) を操作するユーティリティ。
 *
 * 専用の secrets エンドポイントのみを使用します。
 * script settings の PATCH は「送らなかった binding が削除される」全量置換の
 * セマンティクスを持ち、D1 / KV / R2 の binding を巻き込む危険があるため使いません。
 *
 * なお Cloudflare はシークレットの値を返さないため、読み取れるのは名前だけです。
 */

const CF_API = "https://api.cloudflare.com/client/v4";

export type CloudflareApiConfig = {
  accountId: string;
  token: string;
  scriptName: string;
};

/**
 * wrangler.toml から変更できない、認証基盤に直結するシークレット。
 *
 * BACKUP_ENCRYPTION_KEY は、これを失うと既存のバックアップを一切復号できなくなり、
 * 復元手段そのものが失われるため保護対象に含めています。
 */
export const PROTECTED_SECRETS = new Set([
  "AUTH_SECRET",
  "CLOUDFLARE_API_TOKEN",
  "BACKUP_ENCRYPTION_KEY",
]);

export function getCloudflareApiConfig(): CloudflareApiConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const scriptName = process.env.CLOUDFLARE_SCRIPT_NAME || "modparks";
  if (!accountId || !token) return null;
  return { accountId, token, scriptName };
}

type CfResponse<T> = {
  success: boolean;
  result: T;
  errors?: { code: number; message: string }[];
};

async function cf<T>(cfg: CloudflareApiConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json()) as CfResponse<T>;
  if (!res.ok || !data.success) {
    // エラー本文にシークレットの値が含まれないよう、message のみを取り出す
    const message = data.errors?.map((e) => e.message).join(", ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare API failed: ${message}`);
  }
  return data.result;
}

function secretsPath(cfg: CloudflareApiConfig): string {
  return `/accounts/${cfg.accountId}/workers/scripts/${cfg.scriptName}/secrets`;
}

export type WorkerSecret = { name: string; type: string };

/** シークレットの「名前」一覧を取得する（値は Cloudflare 側からも取得できない） */
export async function listWorkerSecrets(cfg: CloudflareApiConfig): Promise<WorkerSecret[]> {
  const result = await cf<WorkerSecret[] | null>(cfg, secretsPath(cfg));
  return result ?? [];
}

/** シークレットを作成 / 上書きする */
export async function putWorkerSecret(
  cfg: CloudflareApiConfig,
  name: string,
  text: string
): Promise<void> {
  await cf(cfg, secretsPath(cfg), {
    method: "PUT",
    body: JSON.stringify({ name, text, type: "secret_text" }),
  });
}

/** シークレットを削除する */
export async function deleteWorkerSecret(cfg: CloudflareApiConfig, name: string): Promise<void> {
  await cf(cfg, `${secretsPath(cfg)}/${encodeURIComponent(name)}`, { method: "DELETE" });
}
