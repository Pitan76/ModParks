// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Next 16.2.9 では webpack ビルドの Server バンドルが Turbopack の約 3.7 倍
// (gzip 3127 KiB vs 833 KiB) に肥大し、無料プランの 3 MiB 上限を超える。
// また Windows/exFAT では webpack が Server Actions のビルドで落ちる。
export default {
	...defineCloudflareConfig({
		// For best results consider enabling R2 caching
		// See https://opennext.js.org/cloudflare/caching for more details
		// incrementalCache: r2IncrementalCache
	}),
	buildCommand: "next build",
};
