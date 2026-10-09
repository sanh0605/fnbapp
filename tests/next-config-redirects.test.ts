import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

// BR-UI-007: Tổng kết ngày is gone; a saved shortcut to it opens Doanh số on Hôm nay.
describe("next.config.js redirects", () => {
  it("sends /admin/reports/daily to Doanh số on Hôm nay, not permanently", async () => {
    const config = require("../next.config.js");
    const redirects = await config.redirects();
    expect(redirects).toContainEqual({
      source: "/admin/reports/daily",
      destination: "/admin/reports/sales?range=TODAY",
      permanent: false,
    });
  });
});
