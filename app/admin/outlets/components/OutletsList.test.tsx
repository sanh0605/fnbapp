// @vitest-environment jsdom
//
// Render test per docs/superpowers/plans/2026-08-25-outlet-screen-and-nav-
// guard.md section 4: "A rendered test that the outlets page lists the two
// seeded outlets and that the nav contains the entry." OutletsList is what
// page.tsx renders the two seeded outlets through (see OutletsList.tsx's own
// comment for why the async page.tsx itself is not the render target). The
// "nav contains the entry" half is covered by app/admin/nav-guard.test.ts,
// which fails if /admin/outlets has no navItems entry -- so a passing guard
// already proves that half; this file does not duplicate it.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { OutletsList } from "./OutletsList";
import type { DBOutlet, DBBrand } from "@/types/db";

// OutletForm/RetireOutletButton call server actions and lib/dialog -- mocked
// for the same reason as components/POSScreen.itemModal.test.tsx: these
// modules transitively pull in next/cache, lib/sheets_db and lib/auth,
// none of which are needed to check that the list renders.
vi.mock("../actions", () => ({
  addOutlet: vi.fn(),
  editOutlet: vi.fn(),
  retireOutlet: vi.fn(),
}));
vi.mock("@/lib/dialog", () => ({
  confirm: vi.fn(),
  alert: vi.fn(),
}));
// docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
// section B: OutletForm/RetireOutletButton now call useRouter().refresh().
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
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

const BRANDS: DBBrand[] = [
  { id: "BR-001", name: "Phin Đi", code: "PHD", start_date: "", status: "ACTIVE", created_at: "" },
  { id: "BR-002", name: "Uchako", code: "UCK", status: "ACTIVE", start_date: "", created_at: "" },
];

const SEEDED_OUTLETS: DBOutlet[] = [
  {
    id: "OUT-001", code: "001", name: "Điểm bán 1", brand_id: "BR-001", address: "",
    status: "ACTIVE", start_date: null, end_date: null, open_time: null, close_time: null,
    created_at: "", updated_at: "",
  },
  {
    id: "OUT-002", code: "002", name: "Điểm bán 2", brand_id: "BR-002", address: "",
    status: "ACTIVE", start_date: null, end_date: null, open_time: null, close_time: null,
    created_at: "", updated_at: "",
  },
];

describe("OutletsList", () => {
  it("lists the two seeded outlets, their codes and their brands", async () => {
    const container = await renderTracked(<OutletsList outlets={SEEDED_OUTLETS} brands={BRANDS} />);
    const text = container.textContent || "";

    expect(text).toContain("Điểm bán 1");
    expect(text).toContain("Điểm bán 2");
    expect(text).toContain("001");
    expect(text).toContain("002");
    expect(text).toContain("Phin Đi");
    expect(text).toContain("Uchako");
  });

  it("offers edit and retire actions for each active outlet", async () => {
    const container = await renderTracked(<OutletsList outlets={SEEDED_OUTLETS} brands={BRANDS} />);
    const buttons = Array.from(container.querySelectorAll("button")).map(b => b.textContent);

    expect(buttons.filter(t => t === "Sửa")).toHaveLength(2);
    expect(buttons.filter(t => t === "Ngừng hoạt động")).toHaveLength(2);
  });

  it("does not offer to retire an already-inactive outlet", async () => {
    const outlets: DBOutlet[] = [
      { ...SEEDED_OUTLETS[0] },
      { ...SEEDED_OUTLETS[1], status: "INACTIVE", end_date: "2026-08-01" },
    ];
    const container = await renderTracked(<OutletsList outlets={outlets} brands={BRANDS} />);
    const buttons = Array.from(container.querySelectorAll("button")).map(b => b.textContent);

    expect(buttons.filter(t => t === "Ngừng hoạt động")).toHaveLength(1);
    expect(container.textContent).toContain("Ngừng hoạt động"); // the status badge, not just the button
  });

  it("shows an empty state when there are no outlets", async () => {
    const container = await renderTracked(<OutletsList outlets={[]} brands={BRANDS} />);
    expect(container.textContent).toContain("Chưa có điểm bán");
  });
});
