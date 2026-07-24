import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "StocktakeClient.tsx"), "utf8");

describe("StocktakeClient confirmation step", () => {
  it("requires a preview before it exposes the final apply confirmation", () => {
    expect(source).toContain("getStocktakeConfirmPreview");
    expect(source).toContain("confirmStocktakeSession");
    expect(source).toContain("Xác nhận và áp dụng");
    expect(source).toContain("Xác nhận áp dụng");
    expect(source).toContain("Dự kiến áp dụng");
    expect(source).toContain("const isPreviewing = preview !== null");
    expect(source).toContain("disabled={isPreviewing}");
    expect(source).toContain("Quay lại chỉnh sửa");
  });
});
