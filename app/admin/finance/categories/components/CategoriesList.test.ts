import { describe, expect, it } from "vitest";
import { pnlTreatmentLabel } from "./CategoriesList";

describe("pnlTreatmentLabel (BR-CASH-006)", () => {
  it("names the three treatments", () => {
    expect(pnlTreatmentLabel({ affects_pnl: false, is_sales_revenue: false })).toBe("Không");
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: false })).toBe("Có");
    expect(pnlTreatmentLabel({ affects_pnl: true, is_sales_revenue: true })).toBe("Có — doanh thu bán hàng");
  });
});
