import { readFileSync } from "node:fs";

/**
 * 最終的な Worker バンドルを走査し、サーバー実行時には不要なはずのコードが
 * 取り込まれていないかを判定する。
 * handler.mjs は事前バンドル済みで sourcemap から内訳を取れないため、
 * 各依存に固有の文字列（マーカー）の有無で混入を検出する。
 */

/** @type {Array<{name: string, marker: string, why: string}>} */
const MARKERS = [
	{
		name: "react-dom (development build)",
		marker: "react-dom-server.browser.development.js",
		why: "本番では不要。NODE_ENV が静的に production へ解決されていない疑い",
	},
	{
		name: "react development warning",
		marker: "Warning: ReactDOM.render is no longer supported",
		why: "development ビルド混入の裏付け",
	},
	{
		name: "next-devtools",
		marker: "next-devtools",
		why: "開発用ツール。本番バンドルには不要",
	},
	{
		name: "terser",
		marker: "terser",
		why: "ビルド時のみ使うミニファイア。実行時には不要",
	},
	{
		name: "webpack runtime schema",
		marker: "WebpackOptions.check",
		why: "webpack 本体の設定検証コード。実行時には不要",
	},
	{
		name: "@next/font fontkit",
		marker: "fontkit",
		why: "フォント処理はビルド時完結のはず",
	},
	{
		name: "crypto-browserify",
		marker: "crypto-browserify",
		why: "Workers では node:crypto が使えるため不要",
	},
];

/** バンドル内でのマーカー出現回数を数える */
const countOccurrences = (haystack, needle) => {
	let count = 0;
	let idx = haystack.indexOf(needle);
	while (idx !== -1) {
		count += 1;
		idx = haystack.indexOf(needle, idx + needle.length);
	}
	return count;
};

const bundlePath = process.argv[2];
if (!bundlePath) throw new Error("usage: analyze-bundle.mjs <worker.js>");

const bundle = readFileSync(bundlePath, "utf8");
console.log(`bundle: ${bundlePath}`);
console.log(`size: ${(bundle.length / 1024 / 1024).toFixed(2)} MiB\n`);

for (const { name, marker, why } of MARKERS) {
	const hits = countOccurrences(bundle, marker);
	if (hits === 0) {
		console.log(`  OK   ${name}: 混入なし`);
		continue;
	}
	console.log(`  HIT  ${name}: ${hits} occurrences ("${marker}")`);
	console.log(`       -> ${why}`);
}
