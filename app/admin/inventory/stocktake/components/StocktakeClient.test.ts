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

describe("StocktakeClient Plan D D6 -- purchase-unit counting", () => {
  it("reuses buildPackageLines' labels, does not regenerate a second one", () => {
    // The exact defect that broke section 9's own worked example was the
    // same string produced two different ways -- this screen must render
    // line.packageLines (built server-side by lib/stocktake-package-lines.ts)
    // rather than deriving its own sizeLabel string.
    expect(source).toContain("packageLines.map(pkg =>");
    expect(source).toContain("pkg.sizeLabel");
    expect(source).not.toMatch(/sizeLabel\s*=\s*`/); // no local re-derivation
  });

  it("only accepts whole packages, rejects decimals with the BR-INV-007 reason instead of rounding", () => {
    expect(source).toContain("Number.isInteger(parsed)");
    expect(source).toContain("BR-INV-007");
    expect(source).not.toMatch(/Math\.round\(parsed\)|Math\.floor\(parsed\)/);
  });

  it("confirms per purchased item (one card, one button), not per conversion or per ingredient", () => {
    expect(source).toContain("function PackageLineCard(");
    // One handleConfirm per card, summing every conversion's value into a
    // single saveStocktakeLine call -- not one save per conversion.
    expect(source).toContain("async function handleConfirm()");
    expect(source).toContain("sumBaseQty += parsed * pkg.conversionRate");
  });

  it("clears the confirmed state when a line is edited after being confirmed (C6)", () => {
    expect(source).toContain("setConfirmed(false)");
    expect(source).toContain("function handleInputChange(");
  });

  it("lists unconfirmed purchased items by name when previewing, rather than blocking the close", () => {
    expect(source).toContain("unconfirmedLines");
    expect(source).toContain("l.countedQty === null");
    expect(source).toContain("mặt hàng chưa xác nhận");
  });

  it("keeps the legacy base-unit input path for pre-D6 sessions (C8/C16), unchanged", () => {
    expect(source).toContain("function LegacyLineCard(");
    expect(source).toContain("packageLines.length > 0");
  });
});

describe("StocktakeClient Plan D D10 -- mobile (M1-M4), counting happens on a phone at the shelf", () => {
  it("M1: the confirm-preview table has a stacked-card alternative for phones, not just overflow-x-auto", () => {
    expect(source).toContain('hidden md:block');
    expect(source).toContain('md:hidden space-y-2');
    // The package-size inputs stack one per row on a phone too.
    expect(source).toContain("grid-cols-1 sm:grid-cols-3");
  });

  it("M2: every quantity input opens a numeric phone keypad -- numeric for whole-package counts, decimal where fractions are allowed", () => {
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('inputMode="decimal"');
  });

  it("M3: the per-item confirm button and Luu use the default 44px tap target, not the 32px sm size", () => {
    const confirmButton = source.match(/<Button variant=\{confirmed[^}]*\}[^>]*>/)?.[0] ?? "";
    expect(confirmButton).not.toContain('size="sm"');
    const legacySaveButton = source.match(/<Button variant="secondary" onClick=\{handleSave\}[^>]*>/)?.[0] ?? "";
    expect(legacySaveButton).not.toContain('size="sm"');
  });

  it("M4: progress stays visible without scrolling back to the top", () => {
    expect(source).toContain("Đã đếm {countedCount}/{session.lines.length}");
    expect(source).toContain("fixed right-4 bottom-");
  });

  it("does not collapse per-line saving into a submit-at-the-end form -- saveStocktakeLine still fires per line, per confirm", () => {
    expect(source).toContain("await saveStocktakeLine(line.id, sumBaseQty)");
    expect(source).toContain("await saveStocktakeLine(line.id, qty)");
  });
});
