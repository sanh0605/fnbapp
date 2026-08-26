// @vitest-environment jsdom
//
// Render tests per docs/superpowers/plans/2026-08-26-ui-feedback-tool.md
// section 8: the toolbar mounts, picking mode records a selector, a
// general comment saves with no element, an entry can be deleted, and the
// overlay is portalled outside the app tree -- the owner's own
// non-interference condition, asserted rather than assumed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { UiFeedbackTool } from "./UiFeedbackTool";

const roots: Root[] = [];
const appContainers: HTMLElement[] = [];

afterEach(() => {
  while (roots.length) {
    const root = roots.pop()!;
    act(() => {
      root.unmount();
    });
  }
  while (appContainers.length) {
    appContainers.pop()!.remove();
  }
  document.getElementById("ui-feedback-tool-root")?.remove();
  vi.restoreAllMocks();
});

// Simulates {children}'s own mount point -- a container that stands in for
// the app tree, distinct from wherever the tool's own portal target lives.
async function renderInsideAppTree(element: React.ReactElement) {
  const appContainer = document.createElement("div");
  appContainer.id = "app-tree";
  document.body.appendChild(appContainer);
  const root = createRoot(appContainer);
  await act(async () => {
    root.render(element);
  });
  roots.push(root);
  appContainers.push(appContainer);
  return appContainer;
}

async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function findButton(text: string): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent === text);
  if (!btn) throw new Error(`button not found: "${text}"`);
  return btn;
}

// React tracks a controlled input's own last value; setting .value directly
// and dispatching a plain "input" event is silently swallowed. Same
// technique as components/POSScreen.itemModal.test.tsx's setInputValue.
async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function mockFetchSequence(responses: Array<{ ok: boolean; json?: unknown; status?: number }>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      return {
        ok: r.ok,
        status: r.status ?? (r.ok ? 200 : 400),
        json: async () => r.json ?? {},
      } as Response;
    }),
  );
}

describe("UiFeedbackTool", () => {
  beforeEach(() => {
    mockFetchSequence([{ ok: true, json: { entries: [] } }]);
  });

  it("mounts a floating Góp ý button", async () => {
    await renderInsideAppTree(<UiFeedbackTool />);
    expect(findButton("Góp ý")).toBeTruthy();
  });

  it("is portalled outside the app tree, not nested inside it -- the owner's non-interference condition", async () => {
    const appContainer = await renderInsideAppTree(<UiFeedbackTool />);

    const toolRoot = document.getElementById("ui-feedback-tool-root");
    expect(toolRoot).not.toBeNull();
    // The portal container is a direct child of <body>, and is not a
    // descendant of the app-tree container the "page" rendered into.
    expect(toolRoot!.parentElement).toBe(document.body);
    expect(appContainer.contains(toolRoot)).toBe(false);
  });

  it("a general comment saves with no element attached", async () => {
    mockFetchSequence([
      { ok: true, json: { entries: [] } }, // initial load on open
      { ok: true, status: 201, json: { entry: { id: "x" } } }, // POST
      { ok: true, json: { entries: [] } }, // reload after save
    ]);
    await renderInsideAppTree(<UiFeedbackTool />);

    await fireClick(findButton("Góp ý"));
    await fireClick(findButton("Góp ý chung (không chọn phần tử)"));

    await setTextareaValue(document.querySelector("textarea")!, "Trang này ổn, không có gì cụ thể.");
    await fireClick(findButton("Lưu"));

    const calls = (fetch as any).mock.calls;
    const postCall = calls.find((c: any[]) => c[1]?.method === "POST");
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall[1].body);
    expect(body.selector).toBeNull();
    expect(body.note).toBe("Trang này ổn, không có gì cụ thể.");
  });

  it("picking mode records a selector for the clicked element", async () => {
    const target = document.createElement("button");
    target.textContent = "TIỀN MẶT";
    target.className = "bg-primary text-white";
    document.body.appendChild(target);

    mockFetchSequence([
      { ok: true, json: { entries: [] } },
      { ok: true, status: 201, json: { entry: { id: "y" } } },
      { ok: true, json: { entries: [] } },
    ]);
    await renderInsideAppTree(<UiFeedbackTool />);

    await fireClick(findButton("Góp ý"));
    await fireClick(findButton("Chọn phần tử để góp ý"));

    // Picking mode intercepts the next real click anywhere on the page.
    await act(async () => {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(document.body.textContent).toContain("TIỀN MẶT");

    await setTextareaValue(document.querySelector("textarea")!, "Nút này bị che một phần.");
    await fireClick(findButton("Lưu"));

    const calls = (fetch as any).mock.calls;
    const postCall = calls.find((c: any[]) => c[1]?.method === "POST");
    const body = JSON.parse(postCall[1].body);
    expect(body.selector).toBe("button");
    expect(body.className).toBe("bg-primary text-white");
    expect(body.textSnippet).toBe("TIỀN MẶT");

    target.remove();
  });

  it("an entry can be deleted", async () => {
    mockFetchSequence([
      {
        ok: true,
        json: {
          entries: [
            { id: "e1", route: "/pos", viewportWidth: 390, note: "Ghi chú cũ", createdAt: "2026-08-26T00:00:00.000Z" },
          ],
        },
      },
      { ok: true, status: 204 }, // DELETE
      { ok: true, json: { entries: [] } }, // reload after delete
    ]);
    await renderInsideAppTree(<UiFeedbackTool />);

    await fireClick(findButton("Góp ý"));
    expect(document.body.textContent).toContain("Ghi chú cũ");

    await fireClick(findButton("Xoá"));

    const calls = (fetch as any).mock.calls;
    const deleteCall = calls.find((c: any[]) => c[1]?.method === "DELETE");
    expect(deleteCall[0]).toContain("id=e1");
    expect(document.body.textContent).not.toContain("Ghi chú cũ");
  });
});
