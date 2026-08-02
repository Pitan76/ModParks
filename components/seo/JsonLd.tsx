/**
 * JSON-LD をそのまま埋め込むためのコンポーネント。
 *
 * 文字列リテラルで書くと構文崩れに気付けないため、必ずオブジェクトを受け取って
 * JSON.stringify 経由で出力する。
 */
const JsonLd = ({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
};

export default JsonLd;
