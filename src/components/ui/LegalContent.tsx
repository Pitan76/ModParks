import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";

type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

/**
 * 利用規約・プライバシーポリシー用の最小限のマークダウン解析。
 * 対応するのは見出し(## )・箇条書き(- )・段落のみ。
 *
 * 汎用の MarkdownRenderer は react-markdown を Worker バンドルから外すため
 * ssr:false で読み込まれる。法的文書がそれに乗ると JS を実行しない相手
 * (審査ボットやクローラ) には本文が空で届くため、こちらはサーバー側で描画する。
 */
function parseLegalContent(content: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flush() {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
    if (list.length > 0) {
      blocks.push({ type: "list", items: list });
      list = [];
    }
  }

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (line === "") {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else if (line.startsWith("- ")) {
      if (paragraph.length > 0) flush();
      list.push(line.slice(2).trim());
    } else {
      if (list.length > 0) flush();
      paragraph.push(line);
    }
  }
  flush();

  return blocks;
}

/**
 * 本文中に素で書かれた URL をリンクに変換する。
 * マークダウンのリンク記法には対応しない（法的文書では素の URL の方が印刷時に読めるため）。
 */
function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s、。)）]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part)
      ? <Link key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</Link>
      : part
  );
}

type LegalContentProps = {
  content: string;
};

function LegalContent({ content }: LegalContentProps) {
  const blocks = parseLegalContent(content);

  return (
    <Box>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <Typography
              key={i}
              variant="h5"
              component="h2"
              sx={{ fontWeight: 700, mt: 4, mb: 1.5 }}
            >
              {block.text}
            </Typography>
          );
        }

        if (block.type === "list") {
          return (
            <Box key={i} component="ul" sx={{ pl: 3, my: 2 }}>
              {block.items.map((item, j) => (
                <Typography key={j} component="li" variant="body1" sx={{ lineHeight: 1.9 }}>
                  {linkify(item)}
                </Typography>
              ))}
            </Box>
          );
        }

        return (
          <Typography key={i} variant="body1" sx={{ lineHeight: 1.9, mb: 2 }}>
            {linkify(block.text)}
          </Typography>
        );
      })}
    </Box>
  );
}

export default LegalContent;
