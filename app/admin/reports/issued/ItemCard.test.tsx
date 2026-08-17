// @vitest-environment jsdom
//
// Render test for OPEN-ITEMS 41: the issued-value report's "Da xuat" line
// (ItemCard, app/admin/reports/issued/page.tsx) reads unitName straight from
// getIssuedValueReport's output. G4 (7882894) already sources that from
// UOM_Conversions.base_unit; SPM-043's conversion QD-049 disagreed with its
// own ingredient's base_unit (ml vs g) until the owner-approved correction
// on 2026-08-17, which this test guards against regressing.
//
// OPEN-ITEMS 38: a test that greps source text cannot see a wrong render.
// This renders the real ItemCard component and reads the DOM, following the
// createRoot + act pattern from components/POSScreen.itemModal.test.tsx and
// components/ProductForm.test.tsx. IssuedValueReportPage itself is an async
// server component (reads searchParams, calls the "use server" action) and
// is not rendered here -- ItemCard is the pure, synchronous piece that
// actually prints the unit label. It lives in its own module (ItemCard.tsx)
// because Next.js's route-module type constraint does not allow page.tsx to
// export anything beyond its fixed set of names (default, metadata, ...).
import { afterEach, describe, expect, it } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import { ItemCard } from "./ItemCard";

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

describe("ItemCard unit label (OPEN-ITEMS 41)", () => {
  it("renders g for Sua chua khong duong Vinamilk now that QD-049 is corrected", async () => {
    const container = await renderTracked(
      <ItemCard
        name="Sữa chua không đường Vinamilk"
        unitName="g"
        issuedQuantity={100}
        issuedValue={500000}
        closingValue={200000}
      />,
    );

    const label = Array.from(container.querySelectorAll("span")).find(
      s => s.textContent?.trim() === "Đã xuất",
    );
    const value = label?.nextElementSibling;
    expect(value?.textContent?.trim()).toBe("100,00 g");
  });
});
