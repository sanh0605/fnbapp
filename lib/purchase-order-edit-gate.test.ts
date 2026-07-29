import { describe, it, expect } from "vitest";
import { resolvePurchaseOrderEditGate } from "./purchase-order-edit-gate";

describe("resolvePurchaseOrderEditGate", () => {
  it("shows the form for an admin requesting edit on a COMPLETED PO", () => {
    const result = resolvePurchaseOrderEditGate({ role: "ADMIN", editRequested: true, isDraft: false });
    expect(result.showForm).toBe(true);
  });

  it("does not show the form for an admin who did not request edit", () => {
    const result = resolvePurchaseOrderEditGate({ role: "ADMIN", editRequested: false, isDraft: false });
    expect(result.showForm).toBe(false);
  });

  it("does not show the form for a STAFF role requesting edit", () => {
    const result = resolvePurchaseOrderEditGate({ role: "STAFF", editRequested: true, isDraft: false });
    expect(result.showForm).toBe(false);
  });

  it("shows the form for a DRAFT regardless of role or edit request", () => {
    const result = resolvePurchaseOrderEditGate({ role: "STAFF", editRequested: false, isDraft: true });
    expect(result.showForm).toBe(true);
  });
});
