// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

import { createRoot } from "react-dom/client";
import { act } from "react";
import { Dialog } from "./Dialog";
import React from "react";

describe("components/ui/Dialog", () => {
  const render = async (element: React.ReactElement) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(element);
    });
    return {
      container,
      unmount: () => {
        act(() => {
          root.unmount();
        });
        container.remove();
      }
    };
  };

  it("ESC dismisses when dismissible=true", async () => {
    const onClose = vi.fn();
    const { unmount } = await render(
      <Dialog isOpen={true} onClose={onClose} dismissible={true}>
        Content
      </Dialog>
    );
    
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it("ESC does NOT dismiss when dismissible=false", async () => {
    const onClose = vi.fn();
    const { unmount } = await render(
      <Dialog isOpen={true} onClose={onClose} dismissible={false}>
        Content
      </Dialog>
    );
    
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });

  it("Click outside dismisses when dismissible=true", async () => {
    const onClose = vi.fn();
    const { container, unmount } = await render(
      <Dialog isOpen={true} onClose={onClose} dismissible={true}>
        <div id="content">Content</div>
      </Dialog>
    );
    
    await act(async () => {
      // Find backdrop which is the root div rendered by Portal
      // Wait, portal renders into body by default? Let's check ModalPortal.
      // Assuming it renders into body, we can dispatch on the first div that matches inset-0
      const backdrop = Array.from(document.querySelectorAll('div')).find(el => el.className.includes('fixed inset-0'));
      if (backdrop) {
        backdrop.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    });
    
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it("Focus trap keeps tab within dialog", async () => {
    const { unmount } = await render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        <button id="btn1">1</button>
        <button id="btn2">2</button>
      </Dialog>
    );
    
    await act(async () => {
      // queueMicrotask fires, focus goes to dialog
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const btn1 = document.getElementById("btn1");
    const btn2 = document.getElementById("btn2");
    
    await act(async () => {
      btn2?.focus();
    });
    
    expect(document.activeElement).toBe(btn2);
    
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });
    
    expect(document.activeElement).toBe(btn1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    });
    
    expect(document.activeElement).toBe(btn2);
    
    unmount();
  });
});
