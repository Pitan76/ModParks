import type { CartItem } from "./cartStore";

/** 設定のデータエクスポートと同じ4形式に揃える */
export type ExportFormat = "json" | "csv" | "md" | "txt";

export const EXPORT_FORMATS: ExportFormat[] = ["json", "csv", "md", "txt"];

const MIME_TYPES: Record<ExportFormat, string> = {
  json: "application/json;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
};

/** プロジェクトページの絶対URL。クライアント専用なので origin は window から取る */
function buildProjectUrl(slug: string, origin: string): string {
  return `${origin}/projects/${slug}`;
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * カートの中身を指定形式の文字列にする。
 * 含めるのは mod 名とURLの一覧のみ（設定のデータエクスポートと同じ方針）。
 */
export function buildCartExport(items: CartItem[], format: ExportFormat, origin: string): string {
  const rows = items.map((item) => ({ name: item.title, url: buildProjectUrl(item.slug, origin) }));

  if (format === "json") {
    return JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, items: rows }, null, 2);
  }

  if (format === "csv") {
    const header = ["name", "url"].join(",");
    return [header, ...rows.map((r) => [escapeCsv(r.name), escapeCsv(r.url)].join(","))].join("\n");
  }

  if (format === "md") {
    return rows.map((r) => `- [${r.name}](${r.url})`).join("\n") + "\n";
  }

  return rows.map((r) => `${r.name} - ${r.url}`).join("\n") + "\n";
}

/** 文字列を任意のファイル名でダウンロードさせる */
export function downloadTextFile(filename: string, content: string, format: ExportFormat) {
  const blob = new Blob([content], { type: MIME_TYPES[format] });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** カートの中身をファイルとして保存する */
export function exportCart(items: CartItem[], format: ExportFormat) {
  const content = buildCartExport(items, format, window.location.origin);
  downloadTextFile(`modparks_cart.${format}`, content, format);
}
