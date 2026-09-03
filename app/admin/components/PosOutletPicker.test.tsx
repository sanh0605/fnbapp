// @vitest-environment jsdom
//
// Render test per 
// section 5: "the closed-outlet confirmation appears and can be accepted,
// and accepting it still opens the till -- a guard that blocks would be
// worse than none." Extracted from app/admin/layout.tsx specifically so
// this is testable without mocking next-auth/next-navigation (see this
// component's own comment).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { PosOutletPicker } from "./PosOutletPicker";

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }));
vi.mock("@/lib/dialog", () => ({ confirm: mocks.confirm }));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => {
      root.unmount();
    });
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

const OPEN_NOW = { id: "OUT-001", name: "Điểm bán 1", open_time: "06:00", close_time: "21:00" };
const CLOSED_NOW = { id: "OUT-002", name: "Điểm bán 2", open_time: "06:00", close_time: "09:00" };
const NO_STATED_HOURS = { id: "OUT-003", name: "Điểm bán 3", open_time: null, close_time: null };

describe("PosOutletPicker", () => {
  it("opens the till directly for an outlet within its stated hours, no confirmation", async () => {
    const onOpenTill = vi.fn();
    const container = await renderTracked(
      <PosOutletPicker outlets={[OPEN_NOW]} nowHHMM="07:00" onOpenTill={onOpenTill} />,
    );
    await fireClick(container.querySelector("button")!);

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(onOpenTill).toHaveBeenCalledWith("OUT-001");
  });

  it("shows a confirmation for an outlet outside its stated hours, and does not open the till until answered", async () => {
    mocks.confirm.mockImplementation(() => new Promise(() => {})); // never resolves in this test
    const onOpenTill = vi.fn();
    const container = await renderTracked(
      <PosOutletPicker outlets={[CLOSED_NOW]} nowHHMM="15:00" onOpenTill={onOpenTill} />,
    );
    await fireClick(container.querySelector("button")!);

    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Điểm bán 2") }),
    );
    expect(onOpenTill).not.toHaveBeenCalled();
  });

  it("accepting the confirmation still opens the till -- a guard that blocks would be worse than none", async () => {
    mocks.confirm.mockResolvedValue(true);
    const onOpenTill = vi.fn();
    const container = await renderTracked(
      <PosOutletPicker outlets={[CLOSED_NOW]} nowHHMM="15:00" onOpenTill={onOpenTill} />,
    );
    await fireClick(container.querySelector("button")!);

    expect(onOpenTill).toHaveBeenCalledWith("OUT-002");
  });

  it("declining the confirmation does not open the till", async () => {
    mocks.confirm.mockResolvedValue(false);
    const onOpenTill = vi.fn();
    const container = await renderTracked(
      <PosOutletPicker outlets={[CLOSED_NOW]} nowHHMM="15:00" onOpenTill={onOpenTill} />,
    );
    await fireClick(container.querySelector("button")!);

    expect(onOpenTill).not.toHaveBeenCalled();
  });

  it("an outlet with no stated hours never triggers the confirmation", async () => {
    const onOpenTill = vi.fn();
    const container = await renderTracked(
      <PosOutletPicker outlets={[NO_STATED_HOURS]} nowHHMM="03:00" onOpenTill={onOpenTill} />,
    );
    await fireClick(container.querySelector("button")!);

    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(onOpenTill).toHaveBeenCalledWith("OUT-003");
  });

  it("shows an open/closed label only for outlets with stated hours", async () => {
    const container = await renderTracked(
      <PosOutletPicker outlets={[OPEN_NOW, CLOSED_NOW, NO_STATED_HOURS]} nowHHMM="15:00" onOpenTill={vi.fn()} />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));

    // OPEN_NOW is 06:00-21:00 -- still open at 15:00.
    expect(buttons[0].textContent).toContain("Đang trong giờ mở cửa");
    // CLOSED_NOW is 06:00-09:00 -- closed by 15:00.
    expect(buttons[1].textContent).toContain("Ngoài giờ mở cửa");
    expect(buttons[2].textContent).not.toContain("giờ mở cửa");
  });
});
