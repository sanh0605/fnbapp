# POS Offline Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staff member can open POS and complete a sale from start to finish regardless of network state at any point, with the sale timestamp always reflecting the moment "Thanh toán" was pressed, and no order ever lost or duplicated.

**Architecture:** Three independent pieces per `docs/superpowers/specs/2026-07-27-pos-offline-resilience-design.md`: (1) move the recorded sale timestamp from server-generated to client-captured with a sanity bound, (2) an IndexedDB-persisted local order queue that auto-retries on reconnect, reusing the existing idempotent request-token mechanism, (3) a minimal service worker so `/pos` can open with no network. A new admin-only page surfaces late syncs and real (non-network) sync failures.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase/Postgres, Vitest, native IndexedDB (no new runtime dependency), `fake-indexeddb` (new devDependency, test-only).

## Global Constraints

- Sales data integrity is the only hard requirement. Inventory accuracy during an outage is explicitly out of scope -- no stock reservation, no staleness warning.
- Offline login and in-progress-cart persistence are out of scope.
- Staff never see sync status or a pending-order count. All sync visibility is admin-only, on a dashboard page (no push notifications).
- One commit per task. `tsc --noEmit` and the full test suite must stay green after every task. Never push (local commits only, per standing instruction this session).
- Match existing code style exactly: this codebase's Server Actions return `{ success: true, ... } | { success: false, error: string }`, not thrown exceptions, for any expected failure. Migrations follow the house style already used in `supabase/migrations/0038`-`0039`: RLS enabled, all grants revoked then re-granted to `service_role` only, `security definer` + `set search_path = public` on every function.

---

### Task 1: Client-captured-timestamp sanity bound (pure function)

**Files:**
- Create: `lib/pos-captured-at.ts`
- Test: `lib/pos-captured-at.test.ts`

**Interfaces:**
- Produces: `resolveCapturedAt(clientCapturedAt: string | undefined, serverNow?: Date): { createdAt: string; rejected: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
// lib/pos-captured-at.test.ts
import { describe, expect, it } from "vitest";
import { resolveCapturedAt } from "./pos-captured-at";

describe("resolveCapturedAt", () => {
  const serverNow = new Date("2026-06-15T00:00:00.000Z");

  it("uses the client timestamp when it is in the past within 30 days", () => {
    const result = resolveCapturedAt("2026-06-01T00:00:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: "2026-06-01T00:00:00.000Z", rejected: false });
  });

  it("uses the client timestamp when it is up to 5 minutes in the future", () => {
    const result = resolveCapturedAt("2026-06-15T00:05:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: "2026-06-15T00:05:00.000Z", rejected: false });
  });

  it("falls back to server time when the client timestamp is more than 30 days in the past", () => {
    const result = resolveCapturedAt("2026-05-01T00:00:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("falls back to server time when the client timestamp is more than 5 minutes in the future", () => {
    const result = resolveCapturedAt("2026-06-15T00:06:00.000Z", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("falls back to server time when the client timestamp is not a valid date", () => {
    const result = resolveCapturedAt("not-a-date", serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: true });
  });

  it("uses server time when no client timestamp is provided (backward compatible)", () => {
    const result = resolveCapturedAt(undefined, serverNow);
    expect(result).toEqual({ createdAt: serverNow.toISOString(), rejected: false });
  });
});
```

- [ ] **Step 2: Run the test and observe RED**

Run: `node_modules\.bin\vitest.cmd run lib\pos-captured-at.test.ts`
Expected: FAIL -- `lib/pos-captured-at.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
// lib/pos-captured-at.ts
/**
 * Sanity-bounds a client-supplied sale timestamp before it becomes an
 * order's created_at. Exists only to guard against a grossly misconfigured
 * device clock -- not a feature in its own right, expected to reject
 * close to never.
 */

const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes

export function resolveCapturedAt(
  clientCapturedAt: string | undefined,
  serverNow: Date = new Date(),
): { createdAt: string; rejected: boolean } {
  const fallback = serverNow.toISOString();

  if (!clientCapturedAt) {
    return { createdAt: fallback, rejected: false };
  }

  const clientMs = new Date(clientCapturedAt).getTime();
  if (!Number.isFinite(clientMs)) {
    return { createdAt: fallback, rejected: true };
  }

  const deltaMs = clientMs - serverNow.getTime();
  if (deltaMs > MAX_FUTURE_MS || deltaMs < -MAX_PAST_MS) {
    return { createdAt: fallback, rejected: true };
  }

  return { createdAt: clientCapturedAt, rejected: false };
}
```

- [ ] **Step 4: Run the test and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run lib\pos-captured-at.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add lib/pos-captured-at.ts lib/pos-captured-at.test.ts
git commit -m "Claude-Sonnet feat: sale-timestamp sanity bound (pos-offline-resilience task 1)"
```

---

### Task 2: Wire client-captured timestamp into buildOrderFromCart

**Files:**
- Modify: `lib/order-cart.ts` (interface `CartInput` at lines 55-68, `buildOrderFromCart` at lines 101-214)
- Modify: `lib/order-cart.test.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `resolveCapturedAt` from Task 1 (`@/lib/pos-captured-at`).
- Produces: `CartInput.client_captured_at?: string` (new optional field). `BuildOrderResult.order.created_at` reflects the resolved value; `BuildOrderResult.order.migration_notes` contains the literal string `"client_captured_at_rejected"` when the bound rejected the client value (empty string otherwise, unchanged from today).

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `lib/order-cart.test.ts` (this file already sets `vi.useFakeTimers()` / `vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"))` in a file-level `beforeAll`; these new tests move the clock further and must restore it):

```ts
describe("buildOrderFromCart client_captured_at", () => {
  const baseInput: CartInput = {
    brand_id: "BR-002",
    items: [
      {
        product_id: "PROD-024",
        variant_id: "VAR-031",
        qty: 1,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" },
      },
    ],
    payment_method: "CASH",
    actor: { id: "U1", name: "Test" },
  };

  afterEach(() => {
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
  });

  it("uses the client-captured timestamp when within bounds", () => {
    const result = buildOrderFromCart(
      { ...baseInput, client_captured_at: "2026-06-14T10:00:00.000Z" },
      REF,
    );
    expect(result.order.created_at).toBe("2026-06-14T10:00:00.000Z");
    expect(result.order.migration_notes).toBe("");
  });

  it("falls back to server time and annotates migration_notes when the client timestamp is out of bounds", () => {
    const result = buildOrderFromCart(
      { ...baseInput, client_captured_at: "2026-05-01T00:00:00.000Z" },
      REF,
    );
    expect(result.order.created_at).toBe("2026-06-15T00:00:00.000Z");
    expect(result.order.migration_notes).toBe("client_captured_at_rejected");
  });

  it("uses server time when client_captured_at is omitted", () => {
    const result = buildOrderFromCart(baseInput, REF);
    expect(result.order.created_at).toBe("2026-06-15T00:00:00.000Z");
    expect(result.order.migration_notes).toBe("");
  });
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run lib\order-cart.test.ts`
Expected: FAIL -- `client_captured_at` does not exist on `CartInput` (TS error surfaces as a test failure since vitest type-checks via esbuild transform errors, or the field is silently ignored and `created_at`/`migration_notes` assertions fail).

- [ ] **Step 3: Implement**

First, update the vitest import at the top of `lib/order-cart.test.ts` to add `afterEach` (the new tests in Step 1 use it, the file doesn't import it today):

```ts
import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from "vitest";
```

In `lib/order-cart.ts`, add the import:

```ts
import { resolveCapturedAt } from "@/lib/pos-captured-at";
```

Add the field to `CartInput` (after `actor`, matching the file's existing optional-field style like `payments?`):

```ts
export interface CartInput {
  brand_id: string;
  items: CartItemInput[];
  payment_method: "CASH" | "BANK_TRANSFER";
  payments?: CartPaymentInput[];
  manual_order_discount?: { value: number; type: "VND" | "PERCENT" } | null;
  applied_promotion_id?: string | null;
  suppress_auto_promotion?: boolean;
  actor: { id: string; name: string };
  // Captured client-side (new Date()) at the moment "Thanh toán" is
  // pressed, before any network call -- preserved across offline queueing
  // and retries so the recorded sale time is always when the button was
  // pressed, not when the request reached the server. Optional and
  // defaults to server time for any caller that doesn't send it.
  client_captured_at?: string;
}
```

Replace line 109 (`const createdAt = new Date().toISOString();`) and the `migration_notes: ""` field at line 201:

```ts
  const { createdAt, rejected: capturedAtRejected } = resolveCapturedAt(input.client_captured_at);
```

```ts
    migration_notes: capturedAtRejected ? "client_captured_at_rejected" : "",
```

- [ ] **Step 4: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run lib\order-cart.test.ts`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/order-cart.ts lib/order-cart.test.ts
git commit -m "Claude-Sonnet feat: buildOrderFromCart uses client-captured sale timestamp (pos-offline-resilience task 2)"
```

---

### Task 3: Local persisted order queue (IndexedDB)

**Files:**
- Modify: `package.json` (add `fake-indexeddb` to `devDependencies`)
- Create: `lib/pos-offline-queue.ts`
- Test: `lib/pos-offline-queue.test.ts`

**Interfaces:**
- Consumes: `CartInput` from `@/lib/order-cart`.
- Produces: `PendingOrderRecord { requestToken: string; cartInput: CartInput; queuedAt: string; attemptCount: number }`, `enqueuePendingOrder(record: PendingOrderRecord): Promise<void>`, `listPendingOrders(): Promise<PendingOrderRecord[]>` (sorted oldest-`queuedAt`-first), `removePendingOrder(requestToken: string): Promise<void>`, `incrementAttemptCount(requestToken: string): Promise<void>`.

- [ ] **Step 1: Add the test-only dependency**

Run: `npm install --save-dev fake-indexeddb`

- [ ] **Step 2: Write the failing tests**

```ts
// lib/pos-offline-queue.test.ts
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
```

- [ ] **Step 3: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run lib\pos-offline-queue.test.ts`
Expected: FAIL -- `lib/pos-offline-queue.ts` does not exist.

- [ ] **Step 4: Implement**

```ts
// lib/pos-offline-queue.ts
/**
 * Browser-only local queue for POS orders that could not be submitted
 * immediately (offline or a network failure at submission time). Storage
 * only -- retry orchestration lives in components/POSScreen.tsx, since it
 * needs component-scoped state (toasts, draft refresh) the storage layer
 * has no business knowing about.
 */

import type { CartInput } from "@/lib/order-cart";

const DB_NAME = "pos-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_orders";

export interface PendingOrderRecord {
  requestToken: string;
  cartInput: CartInput;
  queuedAt: string;
  attemptCount: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "requestToken" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueuePendingOrder(record: PendingOrderRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPendingOrders(): Promise<PendingOrderRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const records = (request.result as PendingOrderRecord[]).slice();
      records.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingOrder(requestToken: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(requestToken);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementAttemptCount(requestToken: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(requestToken);
    getRequest.onsuccess = () => {
      const record = getRequest.result as PendingOrderRecord | undefined;
      if (record) {
        record.attemptCount += 1;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 5: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run lib\pos-offline-queue.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/pos-offline-queue.ts lib/pos-offline-queue.test.ts
git commit -m "Claude-Sonnet feat: local IndexedDB order queue (pos-offline-resilience task 3)"
```

---

### Task 4: Queue instead of block/rollback on checkout failure

**Files:**
- Modify: `components/POSScreen.tsx` (imports near the top; `handleConfirmCheckout` at lines 657-823; the offline banner at lines 957-961)
- Test: `components/POSScreen.offline.test.ts` (new -- source-text assertions, matching the existing convention for this large stateful component; see `app/pos/actions.test.ts` for the same style used on `submitOrderV2`)

**Interfaces:**
- Consumes: `enqueuePendingOrder`, `PendingOrderRecord` from `@/lib/pos-offline-queue` (Task 3).
- Produces: no new exports (internal component behavior change only).

- [ ] **Step 1: Write the failing source-text test**

```ts
// components/POSScreen.offline.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("POSScreen offline checkout handling", () => {
  const source = readFileSync(resolve(__dirname, "POSScreen.tsx"), "utf8");
  const checkoutSource = source.slice(
    source.indexOf("const handleConfirmCheckout"),
    source.indexOf("const handleConfirmCheckoutRef"),
  );

  it("no longer blocks checkout when offline", () => {
    expect(checkoutSource).not.toMatch(/if \(cart\.length === 0 \|\| !isOnline\) return;/);
    expect(checkoutSource).toContain("if (cart.length === 0) return;");
  });

  it("captures the sale timestamp once and sends it as client_captured_at", () => {
    expect(checkoutSource).toContain("client_captured_at");
  });

  it("attempts to queue before falling back to rollback+retry", () => {
    // The catch block still keeps a rollback fallback for the exceedingly
    // rare case where IndexedDB itself fails (private browsing mode with
    // storage disabled, quota exceeded) -- but queuing must be attempted
    // first, since a network failure (the common case) must never roll
    // back or interrupt the next sale.
    const catchBlock = checkoutSource.slice(checkoutSource.indexOf("} catch (err: any) {"));
    expect(catchBlock).toContain("enqueuePendingOrder");
    const queueIndex = catchBlock.indexOf("enqueuePendingOrder");
    const rollbackIndex = catchBlock.indexOf("setCart(cartBackup)");
    expect(rollbackIndex).toBeGreaterThan(queueIndex);
  });

  it("still rolls back and shows an interactive retry for a real rejection", () => {
    const rejectionBlock = checkoutSource.slice(
      checkoutSource.indexOf("if (res.success) {"),
      checkoutSource.indexOf("} catch (err: any) {"),
    );
    expect(rejectionBlock).toContain("setCart(cartBackup)");
    expect(rejectionBlock).toContain("Thử lại");
  });

  it("updates the offline banner to say orders are still saved", () => {
    expect(source).toContain("vẫn được lưu");
    expect(source).not.toContain("đơn sẽ không gửi được");
  });
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: FAIL on all 5 assertions against current source.

- [ ] **Step 3: Implement**

Add the import near the top of `components/POSScreen.tsx` (alongside the existing `resolvePosCheckoutAttempt` import):

```ts
import { enqueuePendingOrder } from "@/lib/pos-offline-queue";
```

Change the guard at line 658:

```ts
    if (cart.length === 0) return;
```

Insert timestamp capture immediately before the existing `const cartInput: CartInput = {` block (line 676), and add the field inside it:

```ts
    const clientCapturedAt = new Date().toISOString();

    const cartInput: CartInput = {
      brand_id: brandId || "",
      client_captured_at: clientCapturedAt,
      items: cart.map(item => {
```

(The rest of the `cartInput` object literal is unchanged -- `client_captured_at` is simply a new key alongside the existing ones.)

Replace the `catch` block (lines 791-822) so a network-shaped failure queues instead of rolling back:

```ts
    } catch (err: any) {
      setIsCheckingOut(null);
      setProcessingOrder(null);

      try {
        await enqueuePendingOrder({
          requestToken: checkoutAttempt.requestToken,
          cartInput,
          queuedAt: clientCapturedAt,
          attemptCount: 1,
        });
        addToast("success", "Đã lưu đơn hàng, sẽ gửi khi có mạng trở lại.");
        if (draftIdBackup) {
          deletePOSDraft(draftIdBackup).then(delRes => {
            if (delRes.success) refreshDrafts();
          });
        }
      } catch (queueErr) {
        // IndexedDB itself failed (extremely rare -- private browsing mode
        // with storage disabled, or storage quota exceeded). Only now fall
        // back to the old interactive rollback+retry, since there is
        // nowhere left to durably hold the order.
        setCart(cartBackup);
        setActiveDraftId(draftIdBackup);
        setUserCustomDiscount(customDiscountBackup);
        setUserCustomDiscountType(customDiscountTypeBackup);
        setAppliedPromoCode(appliedPromoCodeBackup);
        setPromoCodeInput(promoCodeInputBackup);
        setManualPromoError(manualPromoErrorBackup);
        setIsCartOpen(true);

        const errorMsg = err?.message || String(err);
        setLastCheckoutError({
          method,
          error: errorMsg,
          processingOrder: newProcessingOrder,
        });

        addToast(
          "error",
          `Lỗi hệ thống: ${errorMsg}`,
          {
            label: "Thử lại",
            onClick: () => {
              handleConfirmCheckout(method, payments);
            }
          }
        );
      }
    }
```

Update the offline banner (lines 957-961):

```tsx
        {!isOnline && (
          <div className="bg-warning text-white font-extrabold text-center py-2.5 px-4 text-sm flex items-center justify-center gap-2 animate-fade-in shadow-md shrink-0 relative z-20">
            <span>⚠️ Mất kết nối — đơn vẫn được lưu, sẽ tự gửi khi có mạng</span>
          </div>
        )}
```

- [ ] **Step 4: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Run the full existing POSScreen-adjacent suite to confirm no regression**

Run: `node_modules\.bin\vitest.cmd run app\pos\actions.test.ts app\pos\actions.auth.test.ts`
Expected: PASS, unchanged counts (this task doesn't touch `app/pos/actions.ts`).

- [ ] **Step 6: Commit**

```bash
git add components/POSScreen.tsx components/POSScreen.offline.test.ts
git commit -m "Claude-Sonnet feat: queue orders instead of blocking/rolling back offline (pos-offline-resilience task 4)"
```

---

### Task 5: Background sync of queued orders

**Files:**
- Modify: `components/POSScreen.tsx` (add a new `syncPendingOrders` function and two `useEffect` triggers)
- Test: `components/POSScreen.offline.test.ts` (extend)

**Interfaces:**
- Consumes: `listPendingOrders`, `removePendingOrder`, `incrementAttemptCount` from `@/lib/pos-offline-queue` (Task 3); `submitOrderV2` (already imported); `reportPosSyncFailure` from `@/app/pos/actions` (Task 7 -- forward reference; this task's tests only check for the call site, Task 7 supplies the real action).

- [ ] **Step 1: Write the failing source-text test**

Add to `components/POSScreen.offline.test.ts`:

```ts
describe("POSScreen background sync", () => {
  const source = readFileSync(resolve(__dirname, "POSScreen.tsx"), "utf8");

  it("defines a syncPendingOrders function", () => {
    expect(source).toContain("const syncPendingOrders");
  });

  it("triggers a sync sweep on mount and when the browser regains connectivity", () => {
    expect(source).toMatch(/useEffect\(\(\) => \{\s*syncPendingOrders\(\);\s*\}, \[\]\);/);
    expect(source).toContain('window.addEventListener("online", syncPendingOrders)');
  });

  it("reports a real (non-network) rejection to the server instead of retrying forever", () => {
    const syncSource = source.slice(
      source.indexOf("const syncPendingOrders"),
      source.indexOf("const handleConfirmCheckout"),
    );
    expect(syncSource).toContain("reportPosSyncFailure");
    expect(syncSource).toContain("removePendingOrder(record.requestToken)");
  });

  it("leaves a still-network-failing record in the queue for the next sweep", () => {
    const syncSource = source.slice(
      source.indexOf("const syncPendingOrders"),
      source.indexOf("const handleConfirmCheckout"),
    );
    expect(syncSource).toContain("incrementAttemptCount");
  });
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: FAIL, 4 new failures (`syncPendingOrders` does not exist yet).

- [ ] **Step 3: Implement**

Add the imports (alongside the Task 4 import):

```ts
import {
  enqueuePendingOrder,
  incrementAttemptCount,
  listPendingOrders,
  removePendingOrder,
} from "@/lib/pos-offline-queue";
import { reportPosSyncFailure } from "@/app/pos/actions";
```

Add `syncPendingOrders`, placed above `handleConfirmCheckout` so it can be referenced from the two new `useEffect`s below it:

```ts
  const syncPendingOrders = async () => {
    const pending = await listPendingOrders();
    for (const record of pending) {
      try {
        const res = await submitOrderV2(record.cartInput, record.requestToken);
        if (res.success) {
          await removePendingOrder(record.requestToken);
        } else {
          // A real rejection, not a network failure -- retrying it forever
          // would never succeed. No one is watching this device's screen
          // for this specific order anymore, so surface it to the admin
          // dashboard instead of the staff UI.
          await reportPosSyncFailure(record.requestToken, record.cartInput, res.error);
          await removePendingOrder(record.requestToken);
        }
      } catch {
        // Still no network (or it dropped again mid-retry). Leave it
        // queued; the next online event or page mount will try again.
        await incrementAttemptCount(record.requestToken);
      }
    }
  };

  useEffect(() => {
    syncPendingOrders();
  }, []);

  useEffect(() => {
    window.addEventListener("online", syncPendingOrders);
    return () => {
      window.removeEventListener("online", syncPendingOrders);
    };
  }, []);
```

- [ ] **Step 4: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: PASS, 9/9 (5 from Task 4 + 4 new). `reportPosSyncFailure` does not exist yet (Task 7), so this will show a TypeScript error at this point -- expected and resolved by Task 7. If the test runner's transform fails the whole file on this missing import before Task 7 lands, add a minimal placeholder export now and replace it for real in Task 7:

```ts
// app/pos/actions.ts -- temporary, replaced in Task 7
export async function reportPosSyncFailure(_requestToken: string, _cartInput: unknown, _error?: string) {
  return { success: false, error: "not implemented yet" };
}
```

- [ ] **Step 5: Commit**

```bash
git add components/POSScreen.tsx components/POSScreen.offline.test.ts app/pos/actions.ts
git commit -m "Claude-Sonnet feat: background sync sweep for queued orders (pos-offline-resilience task 5)"
```

---

### Task 6: Migration -- synced_at column and pos_sync_failures table

**Files:**
- Create: `supabase/migrations/0040_pos_sync_tracking.sql`
- Test: `lib/pos-sync-migration.test.ts`

- [ ] **Step 1: Write the failing guard test**

```ts
// lib/pos-sync-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("migration 0040: POS sync tracking", () => {
  const sql = readFileSync(
    resolve(__dirname, "../supabase/migrations/0040_pos_sync_tracking.sql"),
    "utf8",
  ).toLowerCase();

  it("adds synced_at to orders_v2", () => {
    expect(sql).toContain("alter table public.orders_v2 add column if not exists synced_at timestamptz");
  });

  it("creates pos_sync_failures locked down to service_role", () => {
    expect(sql).toContain("create table if not exists public.pos_sync_failures");
    expect(sql).toContain("revoke all on table public.pos_sync_failures from public, anon, authenticated");
    expect(sql).toContain("grant select, insert, update on table public.pos_sync_failures to service_role");
  });

  it("sets synced_at to now() at actual insert time in create_pos_order_atomic", () => {
    expect(sql).toContain("synced_at");
    expect(sql).toMatch(/insert into public\.orders_v2 \([\s\S]*synced_at[\s\S]*\)/);
  });
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run lib\pos-sync-migration.test.ts`
Expected: FAIL -- migration file does not exist.

- [ ] **Step 3: Implement**

```sql
-- supabase/migrations/0040_pos_sync_tracking.sql
--
-- POS offline resilience: distinguish the true sale moment (orders_v2.created_at,
-- now client-captured -- see lib/pos-captured-at.ts) from when the order
-- actually reached the database (synced_at). The gap between them is exactly
-- how long an order sat in a device's local offline queue before syncing.
--
-- pos_sync_failures records a queued order that failed to sync for a real
-- (non-network) reason on a background retry -- no one is watching that
-- device's screen for it anymore, so it needs admin attention instead of
-- an interactive staff-facing retry.

alter table public.orders_v2 add column if not exists synced_at timestamptz;

create table if not exists public.pos_sync_failures (
  id text primary key,
  request_token text not null,
  cart_payload_json jsonb not null,
  error_message text not null,
  occurred_at timestamptz not null default now(),
  resolved boolean not null default false
);
create index if not exists idx_pos_sync_failures_resolved
  on public.pos_sync_failures (resolved, occurred_at desc);

alter table public.pos_sync_failures enable row level security;
revoke all on table public.pos_sync_failures from public, anon, authenticated;
grant select, insert, update on table public.pos_sync_failures to service_role;

drop function if exists public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
);

create function public.create_pos_order_atomic(
  p_brand_code text,
  p_order jsonb,
  p_lines jsonb default '[]'::jsonb,
  p_event jsonb default '{}'::jsonb,
  p_ledger jsonb default '[]'::jsonb,
  p_client_request_id text default null,
  p_payments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_brand_code text;
  v_order_id text;
  v_order_no text;
  v_next_number integer;
  v_line_count integer := 0;
  v_ledger_count integer := 0;
  v_payment_count integer := 0;
  v_client_request_id text;
  v_existing_order_id text;
  v_existing_order_no text;
  v_net_total bigint;
  v_payment_sum bigint;
  v_effective_payments jsonb;
begin
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception 'p_order must be a JSON object';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'p_lines must be a JSON array';
  end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'p_event must be a JSON object';
  end if;
  if p_ledger is null or jsonb_typeof(p_ledger) <> 'array' then
    raise exception 'p_ledger must be a JSON array';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'p_payments must be a JSON array';
  end if;

  v_brand_code := upper(btrim(coalesce(p_brand_code, '')));
  v_order_id := nullif(btrim(p_order->>'id'), '');
  v_client_request_id := nullif(btrim(coalesce(p_client_request_id, '')), '');
  if v_brand_code = '' or v_brand_code !~ '^[A-Z0-9]+$' then
    raise exception 'p_brand_code must contain only letters and numbers';
  end if;
  if v_order_id is null then
    raise exception 'p_order.id is required';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'p_lines must contain at least one row';
  end if;
  if nullif(btrim(p_event->>'id'), '') is null then
    raise exception 'p_event.id is required';
  end if;
  if v_client_request_id is not null and length(v_client_request_id) > 128 then
    raise exception 'p_client_request_id exceeds 128 characters';
  end if;

  v_net_total := coalesce((p_order->>'net_total')::bigint, 0);

  if jsonb_array_length(p_payments) = 0 then
    v_effective_payments := jsonb_build_array(
      jsonb_build_object(
        'id', 'pay-' || v_order_id,
        'method', coalesce(nullif(p_order->>'payment_method', ''), 'CASH'),
        'amount', v_net_total,
        'reference', coalesce(p_order->>'payment_ref', '')
      )
    );
  else
    v_effective_payments := p_payments;
  end if;

  select coalesce(sum((x.amount)::bigint), 0)
  into v_payment_sum
  from jsonb_to_recordset(v_effective_payments) as x(amount numeric);

  if v_payment_sum <> v_net_total then
    raise exception
      'Payment total % does not match order net_total %',
      v_payment_sum, v_net_total;
  end if;

  if v_client_request_id is not null then
    perform pg_advisory_xact_lock(
      hashtext('pos:client_request:' || v_client_request_id)
    );

    select id, order_no
    into v_existing_order_id, v_existing_order_no
    from public.orders_v2
    where client_request_id = v_client_request_id;

    if v_existing_order_id is not null then
      select count(*)::integer
      into v_line_count
      from public.order_lines_v2
      where order_id = v_existing_order_id;

      select count(*)::integer
      into v_ledger_count
      from public.stock_ledger
      where reference_id = v_existing_order_id
        and transaction_type = 'SALES_CONSUME';

      select count(*)::integer
      into v_payment_count
      from public.order_payments
      where order_id = v_existing_order_id;

      return jsonb_build_object(
        'order_id', v_existing_order_id,
        'order_no', v_existing_order_no,
        'line_count', v_line_count,
        'ledger_count', v_ledger_count,
        'payment_count', v_payment_count,
        'idempotent_replay', true
      );
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('pos:order_no:' || v_brand_code));

  select coalesce(max(
    case
      when substring(order_no from length(v_brand_code) + 1) ~ '^[0-9]+$'
      then substring(order_no from length(v_brand_code) + 1)::integer
      else null
    end
  ), 0) + 1
  into v_next_number
  from public.orders_v2
  where left(order_no, length(v_brand_code)) = v_brand_code;

  v_order_no := v_brand_code || lpad(v_next_number::text, 6, '0');

  insert into public.orders_v2 (
    id, order_no, brand_id, status, version, parent_order_id, superseded_by,
    created_at, synced_at, created_by_id, created_by_name, completed_at, voided_at,
    voided_by_id, void_reason, currency, gross_total, promo_discount_total,
    manual_item_discount_total, manual_order_discount, net_total,
    applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json,
    payment_method, payment_ref, migration_notes, client_request_id
  )
  values (
    v_order_id,
    v_order_no,
    p_order->>'brand_id',
    p_order->>'status',
    coalesce((p_order->>'version')::integer, 1),
    coalesce(p_order->>'parent_order_id', ''),
    coalesce(p_order->>'superseded_by', ''),
    (p_order->>'created_at')::timestamptz,
    now(),
    nullif(p_order->>'created_by_id', ''),
    nullif(p_order->>'created_by_name', ''),
    nullif(p_order->>'completed_at', '')::timestamptz,
    nullif(p_order->>'voided_at', '')::timestamptz,
    coalesce(p_order->>'voided_by_id', ''),
    coalesce(p_order->>'void_reason', ''),
    coalesce(nullif(p_order->>'currency', ''), 'VND'),
    coalesce((p_order->>'gross_total')::bigint, 0),
    coalesce((p_order->>'promo_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_item_discount_total')::bigint, 0),
    coalesce((p_order->>'manual_order_discount')::bigint, 0),
    v_net_total,
    coalesce(p_order->>'applied_promotion_id', ''),
    coalesce(p_order->'applied_promotion_snapshot_json', '{}'::jsonb),
    coalesce(p_order->'pos_snapshot_json', '{}'::jsonb),
    nullif(p_order->>'payment_method', ''),
    coalesce(p_order->>'payment_ref', ''),
    coalesce(p_order->>'migration_notes', ''),
    v_client_request_id
  );

  insert into public.order_lines_v2 (
    id, order_id, line_no, product_id, product_snapshot_json, variant_id,
    variant_snapshot_json, qty, unit_price, modifiers_snapshot_json,
    gross_line_total, promo_discount, manual_item_discount,
    order_discount_allocation, net_line_total, cost_at_sale,
    recipe_snapshot_json, promo_discount_reason, manual_discount_reason,
    created_at
  )
  select
    x.id, v_order_id, x.line_no, x.product_id, x.product_snapshot_json,
    x.variant_id, x.variant_snapshot_json, x.qty, x.unit_price,
    x.modifiers_snapshot_json, x.gross_line_total, x.promo_discount,
    x.manual_item_discount, x.order_discount_allocation, x.net_line_total,
    x.cost_at_sale, x.recipe_snapshot_json, x.promo_discount_reason,
    x.manual_discount_reason, coalesce(x.created_at, now())
  from jsonb_to_recordset(p_lines) as x(
    id text,
    order_id text,
    line_no integer,
    product_id text,
    product_snapshot_json jsonb,
    variant_id text,
    variant_snapshot_json jsonb,
    qty integer,
    unit_price bigint,
    modifiers_snapshot_json jsonb,
    gross_line_total bigint,
    promo_discount bigint,
    manual_item_discount bigint,
    order_discount_allocation bigint,
    net_line_total bigint,
    cost_at_sale bigint,
    recipe_snapshot_json jsonb,
    promo_discount_reason text,
    manual_discount_reason text,
    created_at timestamptz
  );
  get diagnostics v_line_count = row_count;

  insert into public.order_events (
    id, order_id, event_type, event_at, actor_id, actor_name, from_version,
    to_version, previous_order_id, delta_json, reason
  )
  values (
    p_event->>'id',
    v_order_id,
    p_event->>'event_type',
    coalesce((p_event->>'event_at')::timestamptz, now()),
    nullif(p_event->>'actor_id', ''),
    nullif(p_event->>'actor_name', ''),
    nullif(p_event->>'from_version', '')::integer,
    (p_event->>'to_version')::integer,
    coalesce(p_event->>'previous_order_id', ''),
    coalesce(p_event->'delta_json', '{}'::jsonb),
    coalesce(p_event->>'reason', '')
  );

  insert into public.stock_ledger (
    id, transaction_type, reference_id, item_reference, quantity_change,
    unit_cost, created_at, order_event_id, cost_at_sale, source, notes
  )
  select
    x.id, x.transaction_type, v_order_id, x.item_reference,
    x.quantity_change, x.unit_cost, x.created_at, x.order_event_id,
    x.cost_at_sale, x.source, x.notes
  from jsonb_to_recordset(p_ledger) as x(
    id text,
    transaction_type text,
    reference_id text,
    item_reference text,
    quantity_change numeric,
    unit_cost numeric,
    created_at timestamptz,
    order_event_id text,
    cost_at_sale numeric,
    source text,
    notes text
  );
  get diagnostics v_ledger_count = row_count;

  insert into public.order_payments (
    id, order_id, method, amount, reference, created_at
  )
  select
    x.id, v_order_id, x.method, x.amount, coalesce(x.reference, ''), now()
  from jsonb_to_recordset(v_effective_payments) as x(
    id text,
    method text,
    amount bigint,
    reference text
  );
  get diagnostics v_payment_count = row_count;

  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'Order line count mismatch';
  end if;
  if v_ledger_count <> jsonb_array_length(p_ledger) then
    raise exception 'Stock ledger count mismatch';
  end if;
  if v_payment_count <> jsonb_array_length(v_effective_payments) then
    raise exception 'Order payment count mismatch';
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'line_count', v_line_count,
    'ledger_count', v_ledger_count,
    'payment_count', v_payment_count,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pos_order_atomic(
  text, jsonb, jsonb, jsonb, jsonb, text, jsonb
) to service_role;
```

- [ ] **Step 4: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run lib\pos-sync-migration.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0040_pos_sync_tracking.sql lib/pos-sync-migration.test.ts
git commit -m "Claude-Sonnet feat: migration for synced_at + pos_sync_failures (pos-offline-resilience task 6)"
```

**Do not run `supabase db push` as part of this task** -- migrations in this project are applied by the owner only. This is called out again in Task 9.

---

### Task 7: Server action to report and resolve sync failures

**Files:**
- Modify: `app/pos/actions.ts` (replace the Task 5 placeholder `reportPosSyncFailure` with the real implementation)
- Create: `app/admin/pos-sync/actions.ts`
- Test: `app/pos/actions.auth.test.ts` (extend), `app/admin/pos-sync/actions.test.ts` (new)

**Interfaces:**
- Produces: `reportPosSyncFailure(requestToken: string, cartInput: CartInput, error?: string): Promise<{ success: boolean; error?: string }>` (in `app/pos/actions.ts`, `"use server"`, `resolveActor()`-guarded like the file's other exports). `getPosSyncAttentionItems(): Promise<{ lateOrders: Array<{ id: string; order_no: string; created_at: string; synced_at: string; delayMinutes: number }>; failures: Array<{ id: string; request_token: string; error_message: string; occurred_at: string }> }>` and `resolvePosSyncFailure(id: string): Promise<{ success: boolean; error?: string }>` (in `app/admin/pos-sync/actions.ts`, `"use server"`, `requireAdmin()`-guarded).

- [ ] **Step 1: Write the failing tests**

Add to `app/pos/actions.auth.test.ts` (mirroring this file's existing mock setup for `resolveActor`/`insert`):

```ts
it("rejects an unauthenticated sync-failure report before writing", async () => {
  mocks.resolveActor.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
  const reportPosSyncFailure = (posActions as any).reportPosSyncFailure;
  expect(reportPosSyncFailure).toBeTypeOf("function");

  const result = await reportPosSyncFailure("tok-1", { brand_id: "BR-1" }, "Payment total mismatch");

  expect(result).toEqual({ success: false, error: "Yêu cầu đăng nhập" });
  expect(mocks.insert).not.toHaveBeenCalled();
});

it("writes an unresolved pos_sync_failures row for an authenticated caller", async () => {
  mocks.resolveActor.mockResolvedValue({
    ok: true,
    actor: { id: "staff-1", name: "Thu ngân", role: "STAFF" },
  });
  mocks.insert.mockResolvedValue(undefined);
  const reportPosSyncFailure = (posActions as any).reportPosSyncFailure;

  const result = await reportPosSyncFailure("tok-1", { brand_id: "BR-1" }, "Payment total mismatch");

  expect(result).toEqual({ success: true });
  expect(mocks.insert).toHaveBeenCalledWith(
    "Pos_Sync_Failures",
    expect.objectContaining({
      request_token: "tok-1",
      error_message: "Payment total mismatch",
      resolved: false,
    }),
  );
});
```

Create `app/admin/pos-sync/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAllNoCache: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAllNoCache: mocks.findAllNoCache,
  update: mocks.update,
}));

import { getPosSyncAttentionItems, resolvePosSyncFailure } from "./actions";

describe("getPosSyncAttentionItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
  });

  it("rejects a non-admin caller before reading anything", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });

    await expect(getPosSyncAttentionItems()).rejects.toThrow("Chỉ ADMIN mới có quyền thực hiện thao tác này");
    expect(mocks.findAllNoCache).not.toHaveBeenCalled();
  });

  it("flags orders synced more than 5 minutes after their sale time", async () => {
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") {
        return [
          { id: "ORD-1", order_no: "PHD000001", created_at: "2026-07-27T07:00:00.000Z", synced_at: "2026-07-27T07:02:00.000Z" },
          { id: "ORD-2", order_no: "PHD000002", created_at: "2026-07-27T07:00:00.000Z", synced_at: "2026-07-27T17:00:00.000Z" },
          { id: "ORD-3", order_no: "PHD000003", created_at: "2026-07-27T07:00:00.000Z", synced_at: null },
        ];
      }
      if (sheet === "Pos_Sync_Failures") return [];
      return [];
    });

    const result = await getPosSyncAttentionItems();

    expect(result.lateOrders).toEqual([
      expect.objectContaining({ id: "ORD-2", delayMinutes: 600 }),
    ]);
  });

  it("lists unresolved sync failures", async () => {
    mocks.findAllNoCache.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return [];
      if (sheet === "Pos_Sync_Failures") {
        return [
          { id: "F-1", request_token: "tok-1", error_message: "Payment total mismatch", occurred_at: "2026-07-27T07:00:00.000Z", resolved: false },
          { id: "F-2", request_token: "tok-2", error_message: "Old error", occurred_at: "2026-07-26T07:00:00.000Z", resolved: true },
        ];
      }
      return [];
    });

    const result = await getPosSyncAttentionItems();

    expect(result.failures).toEqual([
      expect.objectContaining({ id: "F-1", request_token: "tok-1" }),
    ]);
  });
});

describe("resolvePosSyncFailure", () => {
  it("rejects a non-admin caller before writing", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });

    const result = await resolvePosSyncFailure("F-1");

    expect(result).toEqual({ success: false, error: "Chỉ ADMIN mới có quyền thực hiện thao tác này" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("marks a failure resolved for an admin caller", async () => {
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
    mocks.update.mockResolvedValue(undefined);

    const result = await resolvePosSyncFailure("F-1");

    expect(result).toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith("Pos_Sync_Failures", "F-1", { resolved: true });
  });
});
```

- [ ] **Step 2: Run and observe RED**

Run: `node_modules\.bin\vitest.cmd run app\pos\actions.auth.test.ts app\admin\pos-sync\actions.test.ts`
Expected: FAIL -- `app/admin/pos-sync/actions.ts` does not exist; `reportPosSyncFailure` still the Task 5 placeholder.

- [ ] **Step 3: Implement**

Replace the Task 5 placeholder in `app/pos/actions.ts`:

```ts
export async function reportPosSyncFailure(
  requestToken: string,
  cartInput: CartInput,
  error?: string,
): Promise<{ success: boolean; error?: string }> {
  const auth = await resolveActor();
  if (!auth.ok) return { success: false, error: auth.error };

  await insert("Pos_Sync_Failures", {
    id: `psf-${crypto.randomUUID()}`,
    request_token: requestToken,
    cart_payload_json: JSON.stringify(cartInput),
    error_message: error || "Unknown error",
    resolved: false,
  });

  return { success: true };
}
```

(`insert` and `crypto` are already imported at the top of `app/pos/actions.ts`; confirm and add either import only if missing.)

Create `app/admin/pos-sync/actions.ts`:

```ts
"use server";

import { findAllNoCache, update } from "@/lib/sheets_db";
import { requireAdmin } from "@/lib/auth";

export interface PosSyncLateOrder {
  id: string;
  order_no: string;
  created_at: string;
  synced_at: string;
  delayMinutes: number;
}

export interface PosSyncFailureItem {
  id: string;
  request_token: string;
  error_message: string;
  occurred_at: string;
}

const LATE_THRESHOLD_MINUTES = 5;

export async function getPosSyncAttentionItems(): Promise<{
  lateOrders: PosSyncLateOrder[];
  failures: PosSyncFailureItem[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [orders, syncFailures] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Pos_Sync_Failures"),
  ]);

  const lateOrders: PosSyncLateOrder[] = [];
  for (const order of orders as any[]) {
    if (!order.synced_at || !order.created_at) continue;
    const delayMinutes = (new Date(order.synced_at).getTime() - new Date(order.created_at).getTime()) / 60000;
    if (delayMinutes > LATE_THRESHOLD_MINUTES) {
      lateOrders.push({
        id: order.id,
        order_no: order.order_no,
        created_at: order.created_at,
        synced_at: order.synced_at,
        delayMinutes: Math.round(delayMinutes),
      });
    }
  }

  const failures: PosSyncFailureItem[] = (syncFailures as any[])
    .filter(f => !f.resolved)
    .map(f => ({
      id: f.id,
      request_token: f.request_token,
      error_message: f.error_message,
      occurred_at: f.occurred_at,
    }));

  return { lateOrders, failures };
}

export async function resolvePosSyncFailure(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await update("Pos_Sync_Failures", id, { resolved: true });
  return { success: true };
}
```

- [ ] **Step 4: Run and observe GREEN**

Run: `node_modules\.bin\vitest.cmd run app\pos\actions.auth.test.ts app\admin\pos-sync\actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full POSScreen offline suite to confirm the Task 5 placeholder swap didn't break anything**

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 6: Commit**

```bash
git add app/pos/actions.ts app/pos/actions.auth.test.ts app/admin/pos-sync/actions.ts app/admin/pos-sync/actions.test.ts
git commit -m "Claude-Sonnet feat: report/resolve POS sync failures (pos-offline-resilience task 7)"
```

---

### Task 8: Admin "Đơn cần chú ý" page

**Files:**
- Create: `app/admin/pos-sync/page.tsx`
- Modify: `app/admin/page.tsx` (add the dashboard alert, matching the existing `anomalousBackdatedEventCount` pattern at lines 32-36 and 262-269)

**Interfaces:**
- Consumes: `getPosSyncAttentionItems`, `resolvePosSyncFailure` from `./actions` (Task 7); `Alert` component (already used in `app/admin/page.tsx`).

- [ ] **Step 1: Implement the page** (no server-side logic to unit test beyond Task 7's already-tested actions; this step is UI wiring, verified per Step 2's build/type check and manually per Task 9's browser check if a login session is available)

```tsx
// app/admin/pos-sync/page.tsx
import { getPosSyncAttentionItems } from "./actions";
import { PosSyncClient } from "./PosSyncClient";

export const dynamic = "force-dynamic";

export default async function PosSyncPage() {
  const { lateOrders, failures } = await getPosSyncAttentionItems();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Đơn cần chú ý</h1>
      <PosSyncClient lateOrders={lateOrders} failures={failures} />
    </div>
  );
}
```

Create the client component `app/admin/pos-sync/PosSyncClient.tsx`:

```tsx
"use client";

import { useState } from "react";
import { resolvePosSyncFailure } from "./actions";
import type { PosSyncFailureItem, PosSyncLateOrder } from "./actions";

export function PosSyncClient({
  lateOrders,
  failures,
}: {
  lateOrders: PosSyncLateOrder[];
  failures: PosSyncFailureItem[];
}) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const handleResolve = async (id: string) => {
    const res = await resolvePosSyncFailure(id);
    if (res.success) {
      setResolvedIds(prev => new Set(prev).add(id));
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn gửi lại thất bại thật sự — cần xử lý tay
        </h2>
        {failures.filter(f => !resolvedIds.has(f.id)).length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-2">Mã yêu cầu</th>
                <th className="py-2">Lỗi</th>
                <th className="py-2">Thời điểm</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {failures.filter(f => !resolvedIds.has(f.id)).map(f => (
                <tr key={f.id} className="border-b border-border/50">
                  <td className="py-2 font-mono text-xs">{f.request_token}</td>
                  <td className="py-2">{f.error_message}</td>
                  <td className="py-2">{new Date(f.occurred_at).toLocaleString("vi-VN")}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleResolve(f.id)}
                      className="text-primary font-bold hover:underline"
                    >
                      Đã xử lý
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn đồng bộ trễ (chỉ để biết, không cần xử lý)
        </h2>
        {lateOrders.length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-2">Mã đơn</th>
                <th className="py-2">Giờ bán thực tế</th>
                <th className="py-2">Trễ bao lâu</th>
              </tr>
            </thead>
            <tbody>
              {lateOrders.map(o => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2">{o.order_no}</td>
                  <td className="py-2">{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                  <td className="py-2">{o.delayMinutes} phút</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add the dashboard alert**

In `app/admin/page.tsx`, extend the existing count-query `Promise.all` (around line 32) to also count unresolved `pos_sync_failures`:

```ts
  const [{ count: anomalousLedgerCount }, { count: anomalousRecipeCount }, { count: posSyncFailureCount }] = await Promise.all([
    supabase.from("backdated_ledger_events").select("*", { count: "exact", head: true }).eq("status", "PENDING").eq("is_anomalous", true),
    supabase.from("backdated_recipe_events").select("*", { count: "exact", head: true }).eq("status", "PENDING").eq("is_anomalous", true),
    supabase.from("pos_sync_failures").select("*", { count: "exact", head: true }).eq("resolved", false),
  ]);
```

Add a second `Alert` block right after the existing backdated-ledger one (after line 269):

```tsx
      {(posSyncFailureCount || 0) > 0 && (
        <Link href="/admin/pos-sync" className="block">
          <Alert variant="warning" title="Cần xem lại: đơn POS gửi lại thất bại">
            Có {posSyncFailureCount} đơn hàng offline gửi lại thất bại thật sự (không phải do mất mạng).
            Bấm để xem chi tiết.
          </Alert>
        </Link>
      )}
```

- [ ] **Step 3: Verify with tsc and build**

Run: `node_modules\.bin\tsc.cmd --noEmit`
Expected: 0 errors.

Run: `node_modules\.bin\next.cmd build`
Expected: exit 0, `/admin/pos-sync` listed as a new route.

- [ ] **Step 4: Commit**

```bash
git add app/admin/pos-sync/page.tsx app/admin/pos-sync/PosSyncClient.tsx app/admin/page.tsx
git commit -m "Claude-Sonnet feat: admin POS sync attention page (pos-offline-resilience task 8)"
```

---

### Task 9: Service worker for offline page load, full verification, tracking

**Files:**
- Create: `public/pos-sw.js`
- Modify: `components/POSScreen.tsx` (register the service worker on mount)
- Modify: `docs/ROADMAP.md`, `DEVELOPMENT-TRACKING.md`

- [ ] **Step 1: Write the service worker**

```js
// public/pos-sw.js
//
// Minimal, hand-written service worker scoped to the POS page only. Not a
// full PWA framework -- the need is narrow: let /pos open with no network,
// using the last successfully loaded version. See
// docs/superpowers/specs/2026-07-27-pos-offline-resilience-design.md
// (Component 3).

const CACHE_NAME = "pos-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isPosDocument = event.request.mode === "navigate" && url.pathname === "/pos";
  const isNextStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isNextStaticAsset) {
    // Content-hashed by Next.js's build -- never goes stale in a way that
    // matters, so serve from cache first and only hit the network on a
    // cache miss.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isPosDocument) {
    // Network-first: always prefer a fresh render when online (menu/price
    // changes should show up immediately), fall back to the last cached
    // render only when the network request fails outright.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(event.request);
          if (cached) return cached;
          throw new Error("No cached /pos response available offline");
        }),
    );
  }
});
```

- [ ] **Step 2: Register it from POSScreen**

Add near the other mount-time `useEffect`s in `components/POSScreen.tsx`:

```ts
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/pos-sw.js").catch(() => {
        // Registration failure (unsupported browser, etc.) is not fatal --
        // POS keeps working online exactly as it does today, it just won't
        // have an offline-cached fallback.
      });
    }
  }, []);
```

- [ ] **Step 3: Add a source-text test confirming registration**

Add to `components/POSScreen.offline.test.ts`:

```ts
describe("POSScreen service worker registration", () => {
  const source = readFileSync(resolve(__dirname, "POSScreen.tsx"), "utf8");

  it("registers the POS service worker on mount", () => {
    expect(source).toContain('navigator.serviceWorker.register("/pos-sw.js")');
  });
});
```

Run: `node_modules\.bin\vitest.cmd run components\POSScreen.offline.test.ts`
Expected: PASS, 10/10.

- [ ] **Step 4: Full regression pass**

Run: `node_modules\.bin\tsc.cmd --noEmit`
Expected: 0 errors.

Run: `node_modules\.bin\vitest.cmd run`
Expected: all pass, full suite count up by the tests added in Tasks 1-8.

Run: `node_modules\.bin\next.cmd build`
Expected: exit 0.

- [ ] **Step 5: Update tracking docs**

Add an entry to `DEVELOPMENT-TRACKING.md` (top, newest-first) summarizing the 9 tasks and the final verification numbers actually observed in Step 4 (not copied from this plan -- read the real command output).

Update `docs/ROADMAP.md`: this feature was not a pre-existing roadmap row (it was surfaced mid-session while brainstorming `ARCH-1`) -- add a new closed row under P1 or P2 referencing this plan and spec, and note in `ARCH-1`'s row that it was paused for this and should now resume.

- [ ] **Step 6: Commit**

```bash
git add public/pos-sw.js components/POSScreen.tsx components/POSScreen.offline.test.ts DEVELOPMENT-TRACKING.md docs/ROADMAP.md
git commit -m "Claude-Sonnet feat: offline service worker + full verification (pos-offline-resilience task 9)"
```

**Do not push. Do not run `supabase db push` for migration 0040** -- report to the owner that it's ready and wait for them to apply it (same pattern as migrations 0038/0039 earlier this session), since applying it is what actually makes `synced_at`/`pos_sync_failures` usable in production. Task 6-8's code will type-check and build fine before that, but the admin page will show empty/error state against production until the migration is applied.
