import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next.js keeps JSX for its own compiler, while Vitest 4/Vite 8 needs the
  // test transform to lower TSX before import analysis.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "lib/**/*.property.test.ts", "scripts/**/*.test.ts", "app/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/sales/order-math.ts",
        "lib/sales/order-types.ts",
        "lib/sales/order-snapshot.ts",
        "lib/sales/order-cart.ts",
        "lib/sales/order-edit-cart.ts",
        "lib/sales/sheets-db-v2-edit.ts",
        "lib/reports/report-v2-allocators.ts",
      ],
    },
  },
});
