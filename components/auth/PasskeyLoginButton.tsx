"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import Button from "@mui/material/Button";
import KeyIcon from "@mui/icons-material/Key";

interface Props {
  onError: (message: string) => void;
}

/**
 * パスキーでのログインを開始するボタン。
 * サーバーから認証オプションを取得 → ブラウザで署名 → passkey プロバイダで検証。
 */
export default function PasskeyLoginButton({ onError }: Props) {
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey/authenticate", { method: "POST" });
      if (!optRes.ok) throw new Error("options");

      const options = (await optRes.json()) as PublicKeyCredentialRequestOptionsJSON;
      const assertion = await startAuthentication(options);

      const res = await signIn("passkey", { response: JSON.stringify(assertion), redirect: false });
      if (res?.error) {
        onError(tAuth("login.error.passkeyFailed"));
        return;
      }
      router.push(`/${locale}/projects`);
      router.refresh();
    } catch {
      onError(tAuth("login.error.passkeyFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outlined" fullWidth size="large" startIcon={<KeyIcon />} onClick={handleLogin} disabled={loading} sx={{ py: 1.2, mb: 2 }}>
      {tAuth("login.loginWithPasskey")}
    </Button>
  );
}
