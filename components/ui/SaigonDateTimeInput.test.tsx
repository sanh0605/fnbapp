// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  wallToPickerDate,
  pickerDateToWall,
  SaigonDateTimeInput,
} from "./SaigonDateTimeInput";

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.useRealTimers();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => {
      root.unmount();
    });
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
  document.body.innerHTML = "";
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

function getTsxFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("SaigonDateTimeInput", () => {
  it("converts wall-clock string to local Date with correct hours, minutes, and date", () => {
    const d = wallToPickerDate("2026-10-05T15:42");
    expect(d).not.toBeNull();
    expect(d!.getHours()).toBe(15);
    expect(d!.getMinutes()).toBe(42);
    expect(d!.getDate()).toBe(5);
  });

  it("round-trips wall-clock string through local Date", () => {
    expect(pickerDateToWall(wallToPickerDate("2026-10-05T15:42"))).toBe("2026-10-05T15:42");
  });

  it("handles midnight correctly", () => {
    expect(pickerDateToWall(wallToPickerDate("2026-10-05T00:05"))).toBe("2026-10-05T00:05");
  });

  it("returns null for empty or non-matching string, and empty string for null", () => {
    expect(wallToPickerDate("")).toBeNull();
    expect(wallToPickerDate("abc")).toBeNull();
    expect(pickerDateToWall(null)).toBe("");
  });

  it("renders 2026-10-05T15:42 formatted as 05/10/2026 15:42 without AM or PM", async () => {
    const container = await renderTracked(
      <SaigonDateTimeInput value="2026-10-05T15:42" onChange={() => {}} />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("05/10/2026 15:42");
    expect(container.innerHTML).not.toContain("AM");
    expect(container.innerHTML).not.toContain("PM");
  });

  it("renders midnight value 2026-10-05T00:05 as 05/10/2026 00:05", async () => {
    const container = await renderTracked(
      <SaigonDateTimeInput value="2026-10-05T00:05" onChange={() => {}} />
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("05/10/2026 00:05");
  });

  it("guard: no .tsx file under app/ contains type=\"datetime-local\"", () => {
    const appDir = path.join(process.cwd(), "app");
    const tsxFiles = getTsxFiles(appDir);
    const offending: string[] = [];
    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes('type="datetime-local"')) {
        offending.push(path.relative(process.cwd(), file));
      }
    }
    expect(offending, `Found type="datetime-local" in: ${offending.join(", ")}`).toEqual([]);
    // Reads every app/ .tsx file: under a full parallel run it took 6,5 s (2026-10-06).
  }, 30_000);
});
