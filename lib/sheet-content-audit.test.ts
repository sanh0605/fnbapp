import { describe, expect, it } from "vitest";
import { summarizeSheetContent } from "@/lib/sheet-content-audit";

describe("sheet content audit", () => {
  it("marks empty sheets as archive recommended", () => {
    const summary = summarizeSheetContent("Scratch", []);

    expect(summary.recommendation).toBe("ARCHIVE_RECOMMENDED");
    expect(summary.nonEmptyRows).toBe(0);
  });

  it("keeps sheets with formulas for manual review", () => {
    const summary = summarizeSheetContent("P&L", [["Metric", "Value"], ["Revenue", "=SUM(A1:A2)"]]);

    expect(summary.recommendation).toBe("KEEP_REVIEW");
    expect(summary.formulaCells).toBe(1);
  });

  it("marks header-only sheets as archive recommended", () => {
    const summary = summarizeSheetContent("Old_Table", [["id", "name", "status"]]);

    expect(summary.recommendation).toBe("ARCHIVE_RECOMMENDED");
    expect(summary.headers).toEqual(["id", "name", "status"]);
  });
});
