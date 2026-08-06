/**
 * v1 互換シム。
 *
 * ApiVersion はリネーム対象のフィールドを持たないため、v1/v2 で完全に同じ形。
 * 実装は v2 に一本化し、ここでは呼び出すだけにする。
 * 詳細は docs-md/DESIGN.md の「15. 外部ツールへの影響」を参照。
 */
export { GET, POST } from "@/app/api/v2/projects/[slug]/versions/route";
