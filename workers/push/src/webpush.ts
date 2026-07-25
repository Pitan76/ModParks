/**
 * Web Push の暗号化と VAPID 署名を Web Crypto だけで実装する。
 *
 * - 本文暗号化: RFC 8291 (Message Encryption for Web Push) + RFC 8188 (aes128gcm)
 * - 認証: RFC 8292 (VAPID, ES256 JWT)
 *
 * 定番の web-push npm は Node.js の crypto に依存し Cloudflare Workers では動かない。
 * ここは Workers ランタイム（Web Crypto / fetch）だけで完結させている。
 */

import type { PushSubscriptionJSON, VapidKeys } from "./types";

// ─── base64url ────────────────────────────────────────────────────────────────

export function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// ─── HKDF (RFC 5869) ────────────────────────────────────────────────────────

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** HKDF-Extract then Expand で length バイト導出（length <= 32 前提） */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmacSha256(salt, ikm);
  const t = await hmacSha256(prk, concat(info, Uint8Array.of(1)));
  return t.slice(0, length);
}

// ─── VAPID (RFC 8292, ES256) ──────────────────────────────────────────────────

async function importVapidSigningKey(vapid: VapidKeys): Promise<CryptoKey> {
  const pub = b64urlToBytes(vapid.publicKey); // 0x04 || X(32) || Y(32)
  const d = vapid.privateKey;
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** endpoint の origin を aud として ES256 JWT を発行し、Authorization ヘッダ値を返す */
async function buildVapidAuth(endpoint: string, vapid: VapidKeys): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(utf8(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12h（上限24h）
    sub: vapid.subject,
  })));
  const signingInput = `${header}.${payload}`;

  const key = await importVapidSigningKey(vapid);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, utf8(signingInput),
  )); // 既に JOSE 形式 (r||s, 64byte)
  const jwt = `${signingInput}.${bytesToB64url(sig)}`;
  return `vapid t=${jwt}, k=${vapid.publicKey}`;
}

// ─── 本文暗号化 (RFC 8291 + RFC 8188 aes128gcm) ───────────────────────────────

async function encryptPayload(sub: PushSubscriptionJSON, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(sub.keys.p256dh); // 65byte uncompressed point
  const authSecret = b64urlToBytes(sub.keys.auth); // 16byte

  // アプリサーバの一時 ECDH 鍵ペア
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"],
  );
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey)); // 65byte

  // ECDH 共有秘密
  const uaPublicKey = await crypto.subtle.importKey(
    "raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256,
  ));

  // RFC 8291 §3.4: IKM 導出
  const keyInfo = concat(utf8("WebPush: info"), Uint8Array.of(0), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  // RFC 8188: salt から CEK / NONCE
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  // 単一レコード: plaintext || 0x02（最終レコード区切り）
  const record = concat(payload, Uint8Array.of(2));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce }, aesKey, record,
  ));

  // RFC 8188 ヘッダ: salt(16) | rs(4) | idlen(1) | keyid(=asPublic 65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concat(salt, rs, Uint8Array.of(asPublic.length), asPublic);
  return concat(header, ciphertext);
}

// ─── 送信 ─────────────────────────────────────────────────────────────────────

export interface DeliverResult {
  ok: boolean;
  status: number;
  expired: boolean;
  error?: string;
}

/** 1 購読へ暗号化済み本文を POST する */
export async function deliverPush(
  sub: PushSubscriptionJSON,
  payload: string,
  vapid: VapidKeys,
  ttl: number,
): Promise<DeliverResult> {
  const body = await encryptPayload(sub, utf8(payload));
  const authorization = await buildVapidAuth(sub.endpoint, vapid);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      TTL: String(ttl),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: authorization,
    },
    body,
  });

  // 404/410 = 購読失効。呼び出し側で DB から削除させる。
  const expired = res.status === 404 || res.status === 410;
  if (res.ok) return { ok: true, status: res.status, expired: false };
  const error = await res.text().catch(() => "");
  return { ok: false, status: res.status, expired, error: error.slice(0, 500) };
}
