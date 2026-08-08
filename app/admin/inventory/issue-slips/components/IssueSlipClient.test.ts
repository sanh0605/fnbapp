import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "IssueSlipClient.tsx"), "utf8");

describe("IssueSlipClient -- Plan D D7a", () => {
  it("enters quantity in purchase units via a package-size picker, same shape as counting (I3)", () => {
    expect(source).toContain("item?.packageLines.map(p =>");
    expect(source).toContain("p.sizeLabel");
    // The base quantity sent to the server is derived, not typed directly.
    expect(source).toContain("parsedQty * pkg.conversionRate");
  });

  it("warns which months move before submitting a backdated slip, and requires an explicit confirm (I6)", () => {
    expect(source).toContain("computeAffectedMonths");
    expect(source).toContain("affectedMonths.length > 0");
    expect(source).toContain("if (!approved) return;");
  });

  it("does not compute or check on-hand itself -- I4's refusal comes from the RPC, surfaced verbatim", () => {
    expect(source).not.toMatch(/parsedQty\s*>\s*item/);
    expect(source).toContain("I4/I5/I10 refusals from the RPC surface here verbatim");
  });

  it("defaults the time field to now and lets it be edited, storing a real instant not a bare date", () => {
    expect(source).toContain('type="datetime-local"');
    expect(source).toContain("toLocalInputValue(new Date())");
    expect(source).toContain("issuedAt.toISOString()");
  });
});

describe("IssueSlipClient -- Plan D D9, multi-line slip mirroring PurchaseOrderForm", () => {
  it("uses SearchableSelect per line, the same picker PurchaseOrderForm uses", () => {
    expect(source).toContain('import { SearchableSelect } from "@/components/SearchableSelect"');
    expect(source).toContain("<SearchableSelect");
  });

  it("manages an add/remove line list, not a single fixed form", () => {
    expect(source).toContain("function addLine()");
    expect(source).toContain("function removeLine(index");
    expect(source).toContain("lines.map((line, index)");
  });

  it("sends every line to the RPC in one call, not one request per item", () => {
    expect(source).toContain("payloadLines.push(");
    expect(source).toContain("lines: payloadLines");
    // Exactly one createIssueSlip call in handleSubmit -- not looped.
    expect(source.match(/createIssueSlip\(/g)?.length).toBe(1);
  });

  it("shares one time field and one reason across the whole slip, not one per line", () => {
    expect(source).toContain("áp dụng cho cả phiếu");
    expect(source).toContain("const [issuedAtLocal, setIssuedAtLocal]");
    expect(source).toContain("const [reason, setReason]");
    // Only one datetime-local input in the form -- not one inside the line loop.
    expect(source.match(/type="datetime-local"/g)?.length).toBe(1);
  });

  it("validates each line and names which one is wrong, before ever calling the RPC", () => {
    expect(source).toContain("`Dòng ${i + 1}: chưa chọn mặt hàng`");
    expect(source).toContain("`Dòng ${i + 1}: chưa chọn quy cách`");
    expect(source).toContain("`Dòng ${i + 1}: số lượng phải lớn hơn 0`");
  });
});

describe("IssueSlipClient -- Plan D D7b/D9, BR-INV-009 reversal UI", () => {
  it("only offers to reverse a MANUAL row that is not itself a reversal and has not already been reversed", () => {
    expect(source).toContain("!isReversal && !alreadyReversed &&");
    expect(source).toContain("row.reversesIssueId !== null");
    expect(source).toContain("row.reversedByIssueId !== null");
  });

  it("requires an explicit confirm before reversing, naming BR-INV-009 and that the original line is never edited", () => {
    expect(source).toContain("handleReverse(row)");
    expect(source).toContain("Dòng gốc được giữ nguyên, không xoá");
    expect(source).toContain("BR-INV-009");
  });

  it("shows a reversed pair linked both ways, neither row hidden", () => {
    expect(source).toContain("Đảo dòng {row.reversesIssueId}");
    expect(source).toContain("Đã đảo bởi {row.reversedByIssueId}");
  });

  it("D9: groups a slip's rows together by slipId, falling back to the row's own id for legacy/reversal rows", () => {
    expect(source).toContain("row.slipId ?? row.id");
  });

  it("D9: reversal stays per-line -- one button per row, not one per slip", () => {
    expect(source).toContain('reverseIssueSlip({ issueId: row.id, note })');
    expect(source).not.toMatch(/reverse.*[Ss]lip.*all|reverseWholeSlip/);
  });
});

describe("IssueSlipClient -- Plan D D10, layout (empty state, two columns, sized controls) and mobile (M1-M4)", () => {
  it("D10 base: RecentSlipsSection always renders, with an explicit empty state -- never a bare heading over blank space", () => {
    expect(source).not.toContain("if (recentSlips.length === 0) return null;");
    expect(source).toContain("Chưa có phiếu xuất nào");
  });

  it("D10 base: form and recent slips sit in two columns on a wide screen, one column otherwise", () => {
    expect(source).toContain("function TwoColumnLayout(");
    expect(source).toContain("lg:grid-cols-2");
  });

  it("D10 base: Số lượng is a compact field sized to a few digits, not stretched full width; Chi tiết is a single line, not the biggest input on the page", () => {
    expect(source).toContain('<div className="w-24 shrink-0">');
    expect(source).not.toContain("<textarea");
  });

  it("M2: the quantity input opens a numeric phone keypad", () => {
    expect(source).toContain('inputMode="numeric"');
  });

  it("M3: tap targets are sized for a thumb -- add-line and remove-line controls, and the reverse button no longer forced to sm", () => {
    expect(source).toContain("min-h-[44px]");
    expect(source).toContain('className="absolute top-2 right-2 text-text-muted hover:text-danger p-2"');
    const reverseButton = source.match(/<Button\s+variant="danger"[^>]*>/)?.[0] ?? "";
    expect(reverseButton).not.toContain('size="sm"');
  });

  it("M4: a live count of how many lines are actually ready to submit, matching handleSubmit's own validation", () => {
    expect(source).toContain("const filledLineCount = lines.filter(");
    expect(source).toContain("Đã điền đủ: {filledLineCount}/{lines.length} dòng");
  });
});
