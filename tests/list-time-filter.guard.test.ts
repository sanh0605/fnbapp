import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-007: the four lists filter time only through the shared button; the
// loose "Từ ngày" / "Đến ngày" boxes they had before are gone.
const CLIENTS = [
  "app/admin/orders/OrderTable.tsx",
  "app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx",
  "app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx",
  "app/admin/activity-log/components/ActivityLogClient.tsx",
];

describe("list time filter (BR-UI-007)", () => {
  it.each(CLIENTS)("%s uses DateRangeButton and no DayInput", file => {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    expect(src).toContain("DateRangeButton");
    expect(src).not.toMatch(/\bDayInput\b/);
  });
});
