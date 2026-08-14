import { notFound } from "next/navigation";

/**
 * 存在しない任意のサブパスをキャッチし、404を発生させて not-found.tsx にフォールバックするコンポーネント。
 */
export default function CatchAllPage() {
  notFound();
}
