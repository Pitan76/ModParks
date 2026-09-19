import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 以下は .gitignore で除外済みだが、フラット設定の eslint は .gitignore を
    // 読まないため個別に挙げる必要がある。ビルド成果物を検査しても意味が無いうえ、
    // .open-next だけで 800 ファイル超を占めて実際の指摘が埋もれる。
    ".open-next/**",
    ".wrangler/**",
    "mp-recipe/**",
  ]),
  {
    // packages/core は Next.js アプリと Cloudflare Workers の両方から使う。
    // フレームワーク依存が混ざると Workers 側のバンドルに Next が載り、
    // isolate 起動時にその評価 CPU を払うことになる（API を切り出す目的が消える）。
    // 契約の全文は packages/core/README.md を参照。
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next", "next/*",
                "next-auth", "next-auth/*",
                "next-intl", "next-intl/*",
                "@opennextjs/*",
                "react", "react-dom", "react/*", "react-dom/*",
                "@mui/*", "@emotion/*",
                "server-only",
                "@/*",
              ],
              // next-auth の型だけは実行時コストを持たないため allowTypeImports で許す
              allowTypeImports: true,
              message: "packages/core はフレームワークに依存してはならない。値の import は禁止（型のみは可）。詳細は packages/core/README.md",
            },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "JSXAttribute[name.name='component'][value.expression.name='Link']",
          "message": "Do not pass Next.js Link as a component prop directly to MUI components in Server Components. It causes serialization errors. Use LinkButton, LinkCardActionArea, etc. from @/components/ui/ instead."
        }
      ]
    }
  }
]);

export default eslintConfig;
