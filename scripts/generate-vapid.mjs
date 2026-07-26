// VAPID 鍵ペア（P-256）を生成し、base64url で出力する。
//   node scripts/generate-vapid.mjs
//
// 出力の使い方:
//   - VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY → wrangler.toml の [vars] に設定（公開可）
//   - VAPID_PRIVATE_KEY → `wrangler secret put VAPID_PRIVATE_KEY`（秘匿）
//   - VAPID_SUBJECT     → `wrangler secret put VAPID_SUBJECT`（mailto: か https: の連絡先）
//
// ローカル開発では .env-dev に同じ値を入れておく。

import { webcrypto as crypto } from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);

const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey); // 65byte uncompressed
const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey); // d = 秘密鍵スカラー

const publicKey = b64url(rawPublic);
const privateKey = jwk.d; // 既に base64url

console.log("VAPID_PUBLIC_KEY            =", publicKey);
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=", publicKey);
console.log("VAPID_PRIVATE_KEY           =", privateKey);
console.log("VAPID_SUBJECT               = mailto:admin@modparks.pitan76.net");
