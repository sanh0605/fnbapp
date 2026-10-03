import { describe, it, expect } from "vitest";
import { draftKey, saveDraft, takeDraft, type PoDraftState } from "./po-draft";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe("po-draft", () => {
  const sampleState: PoDraftState = {
    supplierId: "SUP-1",
    sourceId: "SRC-1",
    supplierInvoiceCode: "INV-123",
    transactionDate: "2026-10-01T10:00:00.000Z",
    notes: "Ghi chú giao hàng",
    lines: [{ purchased_item_id: "ITEM-1", unit: "kg", quantity: 2, subtotal: 50000 }],
    shippingFee: 10000,
    taxAmount: 5000,
    voucherAmount: 2000,
    discountAmount: 1000,
    paymentMethod: "BANK_TRANSFER",
    bankAccountId: "BA-001",
  };

  it("computes draft key properly", () => {
    expect(draftKey(undefined)).toBe("fnb:po-draft:new");
    expect(draftKey("PO-1")).toBe("fnb:po-draft:PO-1");
  });

  it("saves and takes draft with same now, second take returns null", () => {
    const storage = createMemoryStorage();
    const now = 1_000_000;
    const ok = saveDraft(storage, "fnb:po-draft:new", sampleState, now);
    expect(ok).toBe(true);

    const restored = takeDraft(storage, "fnb:po-draft:new", now);
    expect(restored).toEqual(sampleState);

    const secondTake = takeDraft(storage, "fnb:po-draft:new", now);
    expect(secondTake).toBeNull();
  });

  it("returns null if draft is older than 24 hours", () => {
    const storage = createMemoryStorage();
    const savedAt = 1_000_000;
    saveDraft(storage, "fnb:po-draft:new", sampleState, savedAt);

    const expiredNow = savedAt + 24 * 60 * 60 * 1000 + 1;
    const restored = takeDraft(storage, "fnb:po-draft:new", expiredNow);
    expect(restored).toBeNull();
  });

  it("handles throwing storage on setItem and null storage", () => {
    const throwingStorage: Storage = {
      ...createMemoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(saveDraft(throwingStorage, "key", sampleState, 1000)).toBe(false);
    expect(saveDraft(null, "key", sampleState, 1000)).toBe(false);
    expect(takeDraft(null, "key", 1000)).toBeNull();
  });

  it("returns null on corrupt JSON in storage", () => {
    const storage = createMemoryStorage();
    storage.setItem("fnb:po-draft:new", "invalid-json{");
    expect(takeDraft(storage, "fnb:po-draft:new", 1000)).toBeNull();
  });
});
