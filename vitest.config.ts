import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "lib/**/*.property.test.ts", "scripts/**/*.test.ts", "app/**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "lib/order-math.ts",
        "lib/order-types.ts",
        "lib/order-snapshot.ts",
        "lib/order-cogs.ts",
        "lib/order-cart.ts",
        "lib/order-edit-cart.ts",
        "lib/sheets-db-v2.ts",
        "lib/sheets-db-v2-edit.ts",
        "lib/report-v2-allocators.ts",
      ],
    },
  },
});
