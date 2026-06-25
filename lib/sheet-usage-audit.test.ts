import { describe, expect, it } from "vitest";
import { classifySheets, extractSheetReferences } from "@/lib/sheet-usage-audit";

describe("sheet usage audit", () => {
  it("extracts sheet names from sheets_db helper calls and explicit ranges", () => {
    const refs = extractSheetReferences("app/example.ts", `
      await findAll("Orders_V2");
      await insertMany('Stock_Ledger', rows);
      await sheets.spreadsheets.values.get({ range: "Purchase_Orders!A1:ZZ" });
      const range = \`Order_Lines_V2!\${col}\${row}\`;
    `);

    expect(refs.map(ref => ref.sheetName).sort()).toEqual([
      "Order_Lines_V2",
      "Orders_V2",
      "Purchase_Orders",
      "Stock_Ledger",
    ]);
  });

  it("keeps referenced sheets including case/style variants", () => {
    const report = classifySheets({
      sheets: [
        { title: "Purchased_Items", rowCount: 10, columnCount: 5 },
        { title: "purchased_items", rowCount: 10, columnCount: 5 },
        { title: "Scratch", rowCount: 2, columnCount: 2 },
      ],
      references: [
        { sheetName: "Purchased_Items", filePath: "app/a.ts", line: 1, kind: "helper" },
      ],
    });

    expect(report.find(row => row.title === "Purchased_Items")?.status).toBe("KEEP");
    expect(report.find(row => row.title === "purchased_items")?.status).toBe("KEEP");
    expect(report.find(row => row.title === "Scratch")?.status).toBe("REVIEW");
  });

  it("marks unreferenced backup-style sheets as archive candidates", () => {
    const report = classifySheets({
      sheets: [
        { title: "Orders", rowCount: 10, columnCount: 5 },
        { title: "Orders_BACKUP_PRE_WS5_2026-06-19", rowCount: 10, columnCount: 5 },
      ],
      references: [
        { sheetName: "Orders", filePath: "app/a.ts", line: 1, kind: "helper" },
      ],
    });

    expect(report.find(row => row.title === "Orders_BACKUP_PRE_WS5_2026-06-19")?.status).toBe("ARCHIVE_CANDIDATE");
  });
});
