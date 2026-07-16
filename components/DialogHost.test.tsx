// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { DialogHost } from "./DialogHost";
import { alert, dismiss, dialogStore } from "../lib/dialog";
import React from "react";

describe("components/DialogHost", () => {
  let container: HTMLDivElement;
  let root: any;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    // Clean queue
    while (dialogStore.getSnapshot() !== null) {
      dismiss();
    }
    // Clear body content from portals
    document.body.innerHTML = "";
  });

  const renderComponent = async () => {
    await act(async () => {
      root.render(<DialogHost />);
    });
    // Wait for portals to mount (since ModalPortal has a useEffect setMounted(true))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("renders nothing when no dialog is queued", async () => {
    await renderComponent();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders info variant correctly", async () => {
    alert({ title: "Info Title", message: "Info message content", variant: "info" });
    await renderComponent();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Check title & message
    expect(dialog?.textContent).toContain("Info Title");
    expect(dialog?.textContent).toContain("Info message content");

    // Check success icon background class & text color
    const iconContainer = dialog?.querySelector(".bg-success\\/10");
    expect(iconContainer).not.toBeNull();
    const icon = iconContainer?.querySelector(".text-success");
    expect(icon).not.toBeNull();

    // Check button variant primary
    const okBtn = dialog?.querySelector("button:not([aria-label])");
    expect(okBtn).not.toBeNull();
    expect(okBtn?.className).toContain("bg-primary");
  });

  it("renders warning variant correctly", async () => {
    alert({ title: "Warning Title", message: "Warning message content", variant: "warning" });
    await renderComponent();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Check warning icon background class & text color
    const iconContainer = dialog?.querySelector(".bg-warning\\/10");
    expect(iconContainer).not.toBeNull();
    const icon = iconContainer?.querySelector(".text-warning");
    expect(icon).not.toBeNull();

    // Check button variant warning
    const okBtn = dialog?.querySelector("button:not([aria-label])");
    expect(okBtn).not.toBeNull();
    expect(okBtn?.className).toContain("bg-warning");
  });

  it("renders danger variant correctly", async () => {
    alert({ title: "Danger Title", message: "Danger message content", variant: "danger" });
    await renderComponent();

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();

    // Check danger icon background class & text color
    const iconContainer = dialog?.querySelector(".bg-danger\\/10");
    expect(iconContainer).not.toBeNull();
    const icon = iconContainer?.querySelector(".text-danger");
    expect(icon).not.toBeNull();

    // Check button variant danger
    const okBtn = dialog?.querySelector("button:not([aria-label])");
    expect(okBtn).not.toBeNull();
    expect(okBtn?.className).toContain("bg-danger");
  });
});
