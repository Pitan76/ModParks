"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import KeyIcon from "@mui/icons-material/Key";
import LastUsedBadge from "@/components/auth/LastUsedBadge";
import { rememberLoginMethod } from "@/lib/hooks/useLastLoginMethod";

interface Props {
  onError: (message: string) => void;
  /** 前回のログインがパスキーだった場合に true */
  lastUsed?: boolean;
}

/**
 * パスキーでのログインを開始するボタン。
 * サーバーから認証オプションを取得 → ブラウザで署名 → passkey プロバイダで検証。
 */
export default function PasskeyLoginButton({ onError, lastUsed = false }: Props) {
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
      rememberLoginMethod("passkey");
      router.push(`/${locale}/projects`);
      router.refresh();
    } catch {
      onError(tAuth("login.error.passkeyFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LastUsedBadge active={lastUsed} sx={{ flex: { xs: "1 1 100%", sm: "1 1 0" } }}>
      <Tooltip title={tAuth("login.loginWithPasskey")}>
        <Button
          variant="outlined"
          aria-label={tAuth("login.loginWithPasskey")}
          onClick={handleLogin}
          disabled={loading}
          sx={{ flex: { xs: "1 1 100%", sm: "1 1 0" }, minWidth: 0, py: 1.2 }}
        >
          <KeyIcon />
          {/* パスキーはロゴだけでは伝わりにくいため、hover でツールチップを出せないモバイルのみラベルを添える */}
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" }, ml: 1 }}>
            {tAuth("login.providerPasskey")}
          </Box>
        </Button>
      </Tooltip>
    </LastUsedBadge>
  );
}
