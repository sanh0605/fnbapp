// @vitest-environment jsdom
//
// section 3 (Part A and Part B, both required, not just one): the owner's
// own case -- clicking Xoá on Combo 2 -- covered end to end at the
// component level: the action's result is read (not discarded), an error
// is surfaced via lib/dialog's alert (not silence), and a successful
// delete tells the browser to redraw (router.refresh()), not just the
// server-side revalidatePath already in deleteUnit.
//
// DeleteBtn's onClick handler is directly testable in jsdom (a plain
// button click, not a <form action={...}> submit) -- unlike UnitForm's own
// add/edit handleSubmit, which react-dom 18.3.1 (this repo's version) does
// not reach via any dispatched event under plain vitest+jsdom (see
// PurchasedItemForm.tsx's own comment on this for the full explanation).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { DeleteBtn } from "./UnitForm";

const mocks = vi.hoisted(() => ({
  deleteUnit: vi.fn(),
  confirmDialog: vi.fn(),
  alertDialog: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("@/app/admin/inventory/actions", () => ({
  addUnit: vi.fn(),
  updateUnit: vi.fn(),
  deleteUnit: mocks.deleteUnit,
}));
vi.mock("@/lib/dialog", () => ({
  confirm: mocks.confirmDialog,
  alert: mocks.alertDialog,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => root.unmount());
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
});

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  roots.push(root);
  containers.push(container);
  return container;
}

async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("UnitForm's DeleteBtn -- the owner's Combo 2 case", () => {
  it("A7's exact case: a refused delete shows the real message via alert, and never refreshes", async () => {
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.deleteUnit.mockResolvedValue({
      error:
        "Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước.",
    });

    const container = await renderTracked(<DeleteBtn id="UNT-010" />);
    const button = container.querySelector("button")!;
    await fireClick(button);

    expect(mocks.deleteUnit).toHaveBeenCalled();
    expect(mocks.alertDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Bột cà phê MR.PHIN Robusta Đắk Mil"),
      }),
    );
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
  });

  it("a successful delete refreshes the route and shows no alert", async () => {
    mocks.confirmDialog.mockResolvedValue(true);
    mocks.deleteUnit.mockResolvedValue({});

    const container = await renderTracked(<DeleteBtn id="UNT-002" />);
    const button = container.querySelector("button")!;
    await fireClick(button);

    expect(mocks.deleteUnit).toHaveBeenCalled();
    expect(mocks.alertDialog).not.toHaveBeenCalled();
    expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("declining the confirm dialog never calls deleteUnit at all", async () => {
    mocks.confirmDialog.mockResolvedValue(false);

    const container = await renderTracked(<DeleteBtn id="UNT-002" />);
    const button = container.querySelector("button")!;
    await fireClick(button);

    expect(mocks.deleteUnit).not.toHaveBeenCalled();
    expect(mocks.routerRefresh).not.toHaveBeenCalled();
  });
});
