import { headers } from "next/headers";

/**
 * WebAuthn の RP ID / expected origin を実行時のリクエストヘッダから導出する。
 *
 * localhost 開発と本番でドメインが変わるため、環境変数の固定値ではなく
 * 到来したリクエストの host / origin を信頼源とする。
 */
export interface RpContext {
  rpId: string;
  origin: string;
  rpName: string;
}

const RP_NAME = "ModParks";

export const getRpContext = async (): Promise<RpContext> => {
  const h = await headers();

  const host = h.get("host");
  if (!host) throw new Error("Missing host header for WebAuthn RP ID");

  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const rpId = host.split(":")[0];

  return { rpId, origin: `${proto}://${host}`, rpName: RP_NAME };
};
