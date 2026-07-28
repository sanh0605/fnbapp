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

  it("fingerprints the checkout attempt WITHOUT client_captured_at, so a retry's fresh timestamp never mints a new idempotency token", () => {
    // resolvePosCheckoutAttempt (lib/pos-checkout-idempotency.ts) reuses the
    // existing request token only when the serialized payload is identical
    // across calls. If client_captured_at were part of that payload, every
    // retry (which re-derives a fresh Date().toISOString() call site) would
    // produce a different fingerprint and mint a brand-new token every time,
    // defeating duplicate-order prevention entirely.
    const callIndex = checkoutSource.indexOf("resolvePosCheckoutAttempt(");
    expect(callIndex).toBeGreaterThan(-1);
    const callSite = checkoutSource.slice(callIndex, checkoutSource.indexOf(");", callIndex) + 2);
    expect(callSite).not.toContain("client_captured_at");
    expect(callSite).toContain("cartInputWithoutTimestamp");
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

  it("resets the checkout attempt refs after a successful offline enqueue, so the next identical cart mints a fresh token", () => {
    // Once an order is durably enqueued under a given request token, that
    // token belongs to that specific completed sale. If the refs are not
    // reset here, the very next "Thanh toan" press with an identical cart
    // (common in a beverage shop) would fingerprint the same and reuse the
    // same token, silently merging a second real sale into the first one's
    // queued record.
    const enqueueIndex = checkoutSource.indexOf("enqueuePendingOrder(");
    expect(enqueueIndex).toBeGreaterThan(-1);
    const queueErrIndex = checkoutSource.indexOf("} catch (queueErr)", enqueueIndex);
    expect(queueErrIndex).toBeGreaterThan(enqueueIndex);
    const enqueueSuccessBlock = checkoutSource.slice(enqueueIndex, queueErrIndex);

    expect(enqueueSuccessBlock).toContain("checkoutAttemptRef.current = null;");
    expect(enqueueSuccessBlock).toContain("clientCapturedAtRef.current = null;");
  });

  it("does NOT reset the checkout attempt refs in the queue-failure fallback branch", () => {
    // The rare IndexedDB-failure fallback must keep behaving as an
    // in-progress, retryable attempt -- resetting the refs here would let a
    // still-pending attempt silently mint a new token on manual retry.
    const queueErrIndex = checkoutSource.indexOf("} catch (queueErr)");
    expect(queueErrIndex).toBeGreaterThan(-1);
    const catchBlockEnd = checkoutSource.indexOf("\n    }\n  };", queueErrIndex);
    const queueFailureBlock = checkoutSource.slice(queueErrIndex, catchBlockEnd);

    expect(queueFailureBlock).not.toContain("checkoutAttemptRef.current = null;");
    expect(queueFailureBlock).not.toContain("clientCapturedAtRef.current = null;");
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

  it("Enter-key handler no longer requires isOnline for offline checkout", () => {
    // Extract the Enter key handler section by finding the e.key === "Enter" condition
    const enterKeyIndex = source.indexOf('e.key === "Enter"');
    expect(enterKeyIndex).toBeGreaterThan(-1);

    // Get a bounded section around the Enter condition (the full if statement line)
    const enterKeySection = source.slice(
      Math.max(0, enterKeyIndex - 50),
      enterKeyIndex + 150
    );

    // Verify isOnline is NOT in the Enter key condition
    expect(enterKeySection).not.toMatch(/e\.key === ["']Enter["'].*isOnline/);

    // Verify cart.length guard is still present
    expect(enterKeySection).toMatch(/cart\.length\s*>\s*0/);
  });
});

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

  it("only removes the queued order once reportPosSyncFailure actually succeeded", () => {
    // If reporting the failure itself fails (e.g. the pos_sync_failures
    // table doesn't exist yet before migration 0040 is applied),
    // removePendingOrder must NOT run unconditionally right after it -- that
    // would delete a real sale with no trace anywhere it was ever recorded.
    const syncSource = source.slice(
      source.indexOf("const syncPendingOrders"),
      source.indexOf("const handleConfirmCheckout"),
    );
    const rejectionBranch = syncSource.slice(
      syncSource.indexOf("const report = await reportPosSyncFailure"),
      syncSource.indexOf("} catch {"),
    );

    expect(rejectionBranch).toMatch(/^const report = await reportPosSyncFailure\(/);

    const ifIndex = rejectionBranch.indexOf("if (report.success)");
    const elseIndex = rejectionBranch.indexOf("} else {");
    const removeIndex = rejectionBranch.indexOf("await removePendingOrder(record.requestToken)");
    const incrementIndex = rejectionBranch.indexOf("await incrementAttemptCount(record.requestToken)");

    // removePendingOrder must sit inside the `if (report.success)` branch
    // (before the `else`), and incrementAttemptCount inside the `else`
    // branch -- never removePendingOrder called unconditionally.
    expect(ifIndex).toBeGreaterThan(-1);
    expect(elseIndex).toBeGreaterThan(ifIndex);
    expect(removeIndex).toBeGreaterThan(ifIndex);
    expect(removeIndex).toBeLessThan(elseIndex);
    expect(incrementIndex).toBeGreaterThan(elseIndex);
  });

  it("leaves a still-network-failing record in the queue for the next sweep", () => {
    const syncSource = source.slice(
      source.indexOf("const syncPendingOrders"),
      source.indexOf("const handleConfirmCheckout"),
    );
    expect(syncSource).toContain("incrementAttemptCount");
  });
});

describe("POSScreen service worker registration", () => {
  const source = readFileSync(resolve(__dirname, "POSScreen.tsx"), "utf8");

  it("registers the POS service worker on mount", () => {
    expect(source).toContain('navigator.serviceWorker.register("/pos-sw.js")');
  });
});
