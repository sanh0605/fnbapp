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
