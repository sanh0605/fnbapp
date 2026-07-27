import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  enqueuePendingOrder,
  incrementAttemptCount,
  listPendingOrders,
  removePendingOrder,
  type PendingOrderRecord,
} from "./pos-offline-queue";
import type { CartInput } from "./order-cart";

const cartInput: CartInput = {
  brand_id: "BR-001",
  items: [{ product_id: "PROD-1", variant_id: "VAR-1", qty: 1, modifiers: [], manual_item_discount: { value: 0, type: "VND" } }],
  payment_method: "CASH",
  actor: { id: "U1", name: "Test" },
  client_captured_at: "2026-07-27T00:00:00.000Z",
};

function makeRecord(requestToken: string, queuedAt: string): PendingOrderRecord {
  return { requestToken, cartInput, queuedAt, attemptCount: 0 };
}

describe("pos-offline-queue", () => {
  beforeEach(async () => {
    // fake-indexeddb persists per-import in this test file; clear between tests.
    const existing = await listPendingOrders();
    for (const record of existing) {
      await removePendingOrder(record.requestToken);
    }
  });

  it("stores and lists a pending order", async () => {
    await enqueuePendingOrder(makeRecord("tok-1", "2026-07-27T00:00:00.000Z"));
    const records = await listPendingOrders();
    expect(records).toHaveLength(1);
    expect(records[0].requestToken).toBe("tok-1");
    expect(records[0].cartInput.client_captured_at).toBe("2026-07-27T00:00:00.000Z");
  });

  it("lists pending orders oldest-queued first", async () => {
    await enqueuePendingOrder(makeRecord("tok-later", "2026-07-27T02:00:00.000Z"));
    await enqueuePendingOrder(makeRecord("tok-earlier", "2026-07-27T01:00:00.000Z"));
    const records = await listPendingOrders();
    expect(records.map(r => r.requestToken)).toEqual(["tok-earlier", "tok-later"]);
  });

  it("removes a pending order by request token", async () => {
    await enqueuePendingOrder(makeRecord("tok-1", "2026-07-27T00:00:00.000Z"));
    await removePendingOrder("tok-1");
    expect(await listPendingOrders()).toHaveLength(0);
  });

  it("increments the attempt count without disturbing the rest of the record", async () => {
    await enqueuePendingOrder(makeRecord("tok-1", "2026-07-27T00:00:00.000Z"));
    await incrementAttemptCount("tok-1");
    await incrementAttemptCount("tok-1");
    const records = await listPendingOrders();
    expect(records[0].attemptCount).toBe(2);
    expect(records[0].requestToken).toBe("tok-1");
  });
});
