// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { EventCard } from "./EventCard";

const roots: Root[] = [];
afterEach(() => {
  while (roots.length) act(() => roots.pop()!.unmount());
});

function renderElement(element: React.ReactElement): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(element);
  });
  return container;
}

function render(at: string): string {
  return renderElement(<EventCard kind="MANUAL" label="Phiếu xuất" at={at} itemCount={1} value={1000} />).textContent || "";
}

describe("EventCard (Task 5)", () => {
  it("shows the Saigon day for a 06:30 event, not the UTC day before (A12)", () => {
    // 2026-09-14T23:30:00Z = 15/09/2026 06:30 Saigon
    expect(render("2026-09-14T23:30:00Z")).toContain("15/09/2026");
  });

  it("stays a list using PhoneRow with no font-bold/font-semibold and no text below 12px", () => {
    const container = renderElement(
      <EventCard kind="STOCKTAKE" label="Kiểm kê tháng 9" at="2026-09-30T10:00:00Z" itemCount={5} value={500000} />
    );

    // No bold inside list row (BR-UI-003)
    expect(container.querySelectorAll(".font-bold, .font-semibold")).toHaveLength(0);

    // No text size below 12px (no text-[10px] in badge)
    expect(container.querySelectorAll(".text-\\[10px\\], .text-\\[11px\\], .text-\\[9px\\]")).toHaveLength(0);

    // Old card wrapper is gone, uses PhoneRow structure
    expect(container.querySelector(".rounded-xl")).toBeNull();
    expect(container.querySelector(".line-clamp-2")).not.toBeNull();
  });
});

