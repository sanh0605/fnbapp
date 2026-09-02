import { describe, it, expect } from "vitest";
import { renderOpenItems } from "./open-items";

describe("renderOpenItems", () => {
  it("lists todos grouped as markdown, empty-state when none", () => {
    expect(renderOpenItems([])).toContain("Không có việc treo");
    const md = renderOpenItems([{ title: "phai co nut ngung ban", file: "app/x.test.ts" }]);
    expect(md).toContain("phai co nut ngung ban");
    expect(md).toContain("app/x.test.ts");
  });
});
