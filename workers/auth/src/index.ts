import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import bcrypt from "bcryptjs";
import type { AuthWorkerEnv } from "./env";
import type {
  RegistrationOptionsRequest,
  RegistrationOptionsResult,
  AuthenticationOptionsRequest,
  AuthenticationOptionsResult,
  VerifyRegistrationRequest,
  VerifyRegistrationResult,
  VerifyAuthenticationRequest,
  VerifyAuthenticationResult,
  BcryptHashRequest,
  BcryptHashResult,
  BcryptCompareRequest,
  BcryptCompareResult,
} from "./types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function handleRegistrationOptions(req: Request): Promise<RegistrationOptionsResult> {
  const b = (await req.json()) as RegistrationOptionsRequest;
  return generateRegistrationOptions({
    rpName: b.rpName,
    rpID: b.rpID,
    userID: b.userID,
    userName: b.userName,
    userDisplayName: b.userDisplayName,
    attestationType: "none",
    excludeCredentials: b.excludeCredentials.map((c) => ({
      id: isoBase64URL.toBuffer(c.id),
      type: "public-key" as const,
      transports: c.transports,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
}

async function handleAuthenticationOptions(req: Request): Promise<AuthenticationOptionsResult> {
  const b = (await req.json()) as AuthenticationOptionsRequest;
  // discoverable credential 前提のため allowCredentials は空
  return generateAuthenticationOptions({
    rpID: b.rpID,
    userVerification: b.userVerification,
    allowCredentials: [],
  });
}

async function handleVerifyRegistration(req: Request): Promise<VerifyRegistrationResult> {
  const b = (await req.json()) as VerifyRegistrationRequest;
  const verification = await verifyRegistrationResponse({
    response: b.response,
    expectedChallenge: b.expectedChallenge,
    expectedOrigin: b.expectedOrigin,
    expectedRPID: b.expectedRPID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }
  const info = verification.registrationInfo;
  return {
    verified: true,
    registrationInfo: {
      credentialID: isoBase64URL.fromBuffer(info.credentialID),
      credentialPublicKey: isoBase64URL.fromBuffer(info.credentialPublicKey),
      counter: info.counter,
      credentialDeviceType: info.credentialDeviceType,
      credentialBackedUp: info.credentialBackedUp,
    },
  };
}

async function handleVerifyAuthentication(req: Request): Promise<VerifyAuthenticationResult> {
  const b = (await req.json()) as VerifyAuthenticationRequest;
  const verification = await verifyAuthenticationResponse({
    response: b.response,
    expectedChallenge: b.expectedChallenge,
    expectedOrigin: b.expectedOrigin,
    expectedRPID: b.expectedRPID,
    authenticator: {
      credentialID: isoBase64URL.toBuffer(b.authenticator.credentialID),
      credentialPublicKey: isoBase64URL.toBuffer(b.authenticator.credentialPublicKey),
      counter: b.authenticator.counter,
      transports: b.authenticator.transports,
    },
  });

  return {
    verified: verification.verified,
    newCounter: verification.verified ? verification.authenticationInfo.newCounter : 0,
  };
}

async function handleBcryptHash(req: Request): Promise<BcryptHashResult> {
  const b = (await req.json()) as BcryptHashRequest;
  return { hash: await bcrypt.hash(b.password, b.rounds) };
}

async function handleBcryptCompare(req: Request): Promise<BcryptCompareResult> {
  const b = (await req.json()) as BcryptCompareRequest;
  return { match: await bcrypt.compare(b.password, b.hash) };
}

const ROUTES: Record<string, (req: Request) => Promise<unknown>> = {
  "/registration-options": handleRegistrationOptions,
  "/authentication-options": handleAuthenticationOptions,
  "/verify-registration": handleVerifyRegistration,
  "/verify-authentication": handleVerifyAuthentication,
  "/bcrypt-hash": handleBcryptHash,
  "/bcrypt-compare": handleBcryptCompare,
};

const worker = {
  async fetch(req: Request, _env: AuthWorkerEnv): Promise<Response> {
    const handler = ROUTES[new URL(req.url).pathname];
    if (!handler) return json({ error: "Not found" }, 404);
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      return json(await handler(req));
    } catch (e) {
      console.error("auth worker failed:", e);
      return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
    }
  },
};

export default worker;
