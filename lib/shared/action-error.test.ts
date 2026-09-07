import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeActionError } from "./action-error";

describe("describeActionError", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  beforeEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  it("replaces a raw ASCII exception with the generic Vietnamese sentence, keeping the raw text as errorDetail", () => {
    // The owner's own real case: components/... no -- app/admin/inventory/
    // purchase-orders' downstream findAll(Item_Categories) call, section 1
    // of the plan.
    const result = describeActionError(new Error("findAll(Item_Categories): JWT issued at future"));

    expect(result.error).not.toContain("JWT");
    expect(result.error).not.toContain("Item_Categories");
    expect(result.error).toMatch(/Có lỗi xảy ra/);
    expect(result.errorDetail).toBe("findAll(Item_Categories): JWT issued at future");
  });

  it("logs the raw error server-side when it genericizes the message -- nothing is lost", () => {
    const original = new Error("Could not find the table 'public.purchase_order_edits'");
    describeActionError(original);

    expect(consoleErrorSpy).toHaveBeenCalledWith("[ActionError]", original);
  });

  it("passes a message with Vietnamese diacritics through unchanged -- it was already written for the owner", () => {
    const result = describeActionError(new Error("Tên này đã có rồi: \"Cà phê sữa\" (mã ING-033)."));

    expect(result.error).toBe('Tên này đã có rồi: "Cà phê sữa" (mã ING-033).');
    expect(result.errorDetail).toBeUndefined();
  });

  it("does not log server-side when the message already passes through -- it explains itself", () => {
    describeActionError(new Error("Vui lòng chọn nguồn nhập hàng"));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // Real fixtures from RPC guard refusals this codebase already relies on
  // relaying verbatim (existing tests pin these; this file's own change
  // must not be the thing that breaks them).
  it.each([
    ["create_issue_slip_atomic (I4/I5/I10)", "create_issue_slip_atomic: Dòng 2 (Dâu sấy): yêu cầu xuất 5000 g, chỉ còn 3600 g tính tới thời điểm ..."],
    ["reverse_manual_issue_atomic", "reverse_manual_issue_atomic: Phiếu ISS-00001 đã được đảo bởi ISS-00002 trước đó, không đảo hai lần"],
    ["cancel_issue_slip_atomic (U11)", "cancel_issue_slip_atomic: Phiếu ISL-00003 không còn dòng nào để huỷ -- có thể đã được đảo toàn bộ trước đó"],
    ["reverse_stocktake_session_atomic (U2-U4, post-0063 wording)", "Đang có một phiên kiểm kê đang mở -- xử lý xong phiên đó trước khi huỷ phiên đã áp dụng"],
  ])("relays %s's own refusal verbatim", (_label, message) => {
    const result = describeActionError(new Error(message));
    expect(result.error).toBe(message);
  });

  it("handles a non-Error thrown value the same way, via String(error)", () => {
    // eslint-disable-next-line no-throw-literal -- exercising a caller that threw a bare string
    const result = describeActionError("some raw string, not an Error instance");
    expect(result.error).toMatch(/Có lỗi xảy ra/);
    expect(result.errorDetail).toBe("some raw string, not an Error instance");
  });
});
