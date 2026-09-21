/**
 * Cookie ヘッダから該当の値だけを抜く。Cookie の解析器を持ち込まないため。
 * 値に = を含むもの（base64 など）も崩さないよう、最初の = でだけ分ける。
 */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }

  return undefined;
}
