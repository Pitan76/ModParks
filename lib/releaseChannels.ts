/**
 * バージョンのリリースチャネル区分（プレリリース / ベータ）。
 * 表示ラベルは i18n(`Version.channels.*`) 側で管理する。
 */
export const RELEASE_CHANNELS = ["release", "beta", "alpha"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const DEFAULT_RELEASE_CHANNEL: ReleaseChannel = "release";

/** MUI の色トークンへのマッピング。安定版は目立たせず、プレリリースを警告色にする。 */
const CHANNEL_COLORS: Record<ReleaseChannel, "success" | "warning" | "default"> = {
  release: "success",
  beta: "warning",
  alpha: "default",
};

export function getChannelColor(channel: string): "success" | "warning" | "default" {
  return CHANNEL_COLORS[channel as ReleaseChannel] ?? "default";
}

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return typeof value === "string" && (RELEASE_CHANNELS as readonly string[]).includes(value);
}

/** GitHub Release の prerelease フラグからチャネルを決定する。 */
export function channelFromGithubPrerelease(prerelease: boolean): ReleaseChannel {
  return prerelease ? "beta" : "release";
}
