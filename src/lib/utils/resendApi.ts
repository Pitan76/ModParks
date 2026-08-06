/**
 * Resend API のうち、送信元ドメインの検証状態を確認するための最小限のクライアント。
 */

const RESEND_API = "https://api.resend.com";

export type ResendDomain = { name: string; status: string };

/** ドメイン一覧の取得結果。API に到達できなかった場合は unavailable を返す */
export type DomainLookup =
  | { available: true; domains: ResendDomain[] }
  | { available: false; reason: string };

/**
 * Resend に登録されているドメイン一覧を取得する。
 *
 * API キー未設定や Resend 側の障害では例外を投げず unavailable を返します。
 * 「確認できなかった」ことと「未検証だと分かった」ことを呼び出し側で区別するためです。
 */
export async function listResendDomains(): Promise<DomainLookup> {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) return { available: false, reason: "AUTH_RESEND_KEY is not configured" };

  try {
    const res = await fetch(`${RESEND_API}/domains`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { available: false, reason: `Resend API returned ${res.status}` };

    const body = (await res.json()) as { data?: ResendDomain[] };
    if (!Array.isArray(body.data)) return { available: false, reason: "Unexpected Resend API response" };

    return { available: true, domains: body.data };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Failed to reach Resend API",
    };
  }
}

/** メールアドレスからドメイン部分を取り出す */
export function domainOf(address: string): string {
  return address.slice(address.lastIndexOf("@") + 1).toLowerCase();
}

export type DomainCheck =
  | { ok: true }
  | { ok: false; kind: "unverified"; domain: string; verified: string[] }
  | { ok: false; kind: "unknown"; reason: string };

/**
 * 送信元アドレスのドメインが Resend で検証済みかを確認する。
 *
 * - 検証済み          → ok
 * - 未検証と判明      → unverified（保存を止める）
 * - 確認できなかった  → unknown（保存は通し、警告のみ出す）
 */
export async function checkSenderDomain(address: string): Promise<DomainCheck> {
  const lookup = await listResendDomains();
  if (!lookup.available) return { ok: false, kind: "unknown", reason: lookup.reason };

  const verified = lookup.domains
    .filter((d) => d.status.toLowerCase() === "verified")
    .map((d) => d.name.toLowerCase());

  if (verified.includes(domainOf(address))) return { ok: true };
  return { ok: false, kind: "unverified", domain: domainOf(address), verified };
}
