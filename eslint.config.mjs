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
  ]),
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
