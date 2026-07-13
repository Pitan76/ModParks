// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Turbopack ビルドは Server バンドルが肥大し無料プランの 3 MiB を超えるため、
// CI(Linux)では webpack ビルドを使う。ローカル Windows/exFAT では webpack が
// Server Actions で落ちるので Turbopack のまま。CF_WEBPACK_BUILD で切り替える。
const buildCommand =
	process.env.CF_WEBPACK_BUILD === "1" ? "next build --webpack" : "next build";

export default {
	...defineCloudflareConfig({
		// For best results consider enabling R2 caching
		// See https://opennext.js.org/cloudflare/caching for more details
		// incrementalCache: r2IncrementalCache
	}),
	buildCommand,
};
