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

function render(at: string): string {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(<EventCard kind="MANUAL" label="Phiếu xuất" at={at} itemCount={1} value={1000} />);
  });
  return container.textContent || "";
}

describe("EventCard date (A12)", () => {
  it("shows the Saigon day for a 06:30 event, not the UTC day before", () => {
    // 2026-09-14T23:30:00Z = 15/09/2026 06:30 Saigon
    expect(render("2026-09-14T23:30:00Z")).toContain("15/09/2026");
  });
});
