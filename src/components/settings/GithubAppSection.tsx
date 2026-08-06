"use client";

/**
 * GitHub App（非公開リポジトリの取り込み）の連携状態と導線。
 *
 * インストールと解除は GitHub 側で行うため、ここは状態表示とリンクに徹する。
 * Setup コールバックが ?githubApp=connected|removed|error を付けて戻ってくるので、
 * それを一度だけ表示して URL からは落とす。
 */
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

interface GithubAppSectionProps {
  /** インストール先アカウント名の一覧。空ならインストールなし */
  installedAccounts: string[];
  /** サーバーに GitHub App が設定されていなければ null */
  installUrl: string | null;
}

type FlashKey = "connected" | "removed" | "error";

const FLASH_SEVERITY: Record<FlashKey, "success" | "info" | "error"> = {
  connected: "success",
  removed: "info",
  error: "error",
};

function isFlashKey(value: string | null): value is FlashKey {
  return value === "connected" || value === "removed" || value === "error";
}

export default function GithubAppSection({ installedAccounts, installUrl }: GithubAppSectionProps) {
  const t = useTranslations("Settings");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [flash, setFlash] = useState<FlashKey | null>(null);

  const flashParam = searchParams?.get("githubApp") ?? null;

  useEffect(() => {
    if (!isFlashKey(flashParam)) return;
    setFlash(flashParam);
    // 再読み込みで同じメッセージが出続けないよう、クエリだけ落とす
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("githubApp");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [flashParam, router, searchParams]);

  const installed = installedAccounts.length > 0;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{t("githubApp.title")}</Typography>

      {flash && (
        <Alert severity={FLASH_SEVERITY[flash]} sx={{ mb: 3 }} onClose={() => setFlash(null)}>
          {t(`githubApp.${flash}`)}
        </Alert>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("githubApp.desc")}
      </Typography>

      {!installUrl ? (
        <Alert severity="info">{t("githubApp.unavailable")}</Alert>
      ) : (
        <>
          <Typography variant="body1" sx={{ mb: 3 }}>
            {t("github.status")}:{" "}
            <strong>
              {installed
                ? t("githubApp.installedOn", { accounts: installedAccounts.join(", ") })
                : t("githubApp.notInstalled")}
            </strong>
          </Typography>

          <Button
            variant={installed ? "outlined" : "contained"}
            component="a"
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {installed ? t("githubApp.manage") : t("githubApp.install")}
          </Button>

          {installed && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t("githubApp.manageDesc")}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
