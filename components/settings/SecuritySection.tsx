"use client";

import { useState } from "react";
import SecurityTab from "./tabs/SecurityTab";
import type { PasskeyInfo } from "@/lib/actions/passkey";

/** セキュリティ設定。2 段階認証の切り替えを即座に画面へ反映するため状態を持つ */
export default function SecuritySection({
  twoFactorEnabled,
  passkeys,
}: {
  twoFactorEnabled: boolean;
  passkeys: PasskeyInfo[];
}) {
  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);

  return (
    <SecurityTab
      is2FAEnabled={is2FAEnabled}
      setIs2FAEnabled={setIs2FAEnabled}
      passkeys={passkeys}
    />
  );
}
