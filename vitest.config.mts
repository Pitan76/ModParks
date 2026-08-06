import { defineConfig } from "vitest/config";

/**
 * 対象は DB や Next のランタイムに依存しない純粋ロジックのみ。
 * I/O を含む層はここでは扱わない（境界を跨ぐとテストが環境に依存するため）。
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
