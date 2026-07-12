export interface LinkItem {
  title: string;
  url: string;
}

/** JSON 文字列（`[{title,url}]`）を安全に LinkItem[] へパースする */
export function parseLinks(raw?: string | null): LinkItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
