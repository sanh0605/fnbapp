import { describe, it, expect, beforeEach } from "vitest";
import { alert, confirm, dialogStore, dismiss } from "./dialog";

describe("lib/dialog", () => {
  beforeEach(() => {
    // Clear the queue before each test
    while (dialogStore.getSnapshot() !== null) {
      dismiss();
    }
  });

  it("alert() returns Promise that resolves when dismissed", async () => {
    const promise = alert({ message: "Test alert" });
    const state = dialogStore.getSnapshot();
    expect(state).not.toBeNull();
    expect(state?.type).toBe("alert");
    expect(state?.options.message).toBe("Test alert");
    
    dismiss();
    await promise; // Should resolve
  });

  it("confirm() returns Promise<boolean> based on dismiss value", async () => {
    const promiseTrue = confirm({ message: "Test confirm true" });
    dismiss(true);
    const resultTrue = await promiseTrue;
    expect(resultTrue).toBe(true);

    const promiseFalse = confirm({ message: "Test confirm false" });
    dismiss(false);
    const resultFalse = await promiseFalse;
    expect(resultFalse).toBe(false);
  });

  it("multiple sequential dialogs queue correctly", async () => {
    const p1 = alert({ message: "Alert 1" });
    const p2 = confirm({ message: "Confirm 2" });
    const p3 = alert({ message: "Alert 3" });

    // First is active
    expect(dialogStore.getSnapshot()?.options.message).toBe("Alert 1");
    dismiss();
    await p1;

    // Second is active
    expect(dialogStore.getSnapshot()?.options.message).toBe("Confirm 2");
    dismiss(true);
    await p2;

    // Third is active
    expect(dialogStore.getSnapshot()?.options.message).toBe("Alert 3");
    dismiss();
    await p3;

    // Queue empty
    expect(dialogStore.getSnapshot()).toBeNull();
  });

  it("variant propagates to dialog state", () => {
    alert({ message: "Info", variant: "info" });
    expect(dialogStore.getSnapshot()?.options.variant).toBe("info");
    dismiss();
  });
});
