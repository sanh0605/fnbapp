// @vitest-environment jsdom
//
// docs/superpowers/plans/2026-09-07-one-price-per-topping.md Task 2: a
// product linked to an ACTIVE modifier (its standalone price now synced
// from the Topping screen, migration 0098) must not let the product form
// be a second editor for that price. Render-tested, since the defect is
// what the owner actually sees: an editable field that quietly stops
// mattering the moment he types in it, with no signal on the form itself.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import ProductForm from "./ProductForm";

const mocks = vi.hoisted(() => ({
  saveProduct: vi.fn(),
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  eraseProduct: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  saveProduct: mocks.saveProduct,
  pauseProduct: mocks.pauseProduct,
  resumeProduct: mocks.resumeProduct,
  eraseProduct: mocks.eraseProduct,
}));

// ProductForm renders CustomDatePicker (react-datepicker) unconditionally;
// that component calls window.matchMedia in a mount effect, which jsdom
// does not implement. Same stub as app/admin/outlets/components/OutletForm.test.tsx.
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

const roots: Root[] = [];
const containers: HTMLElement[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (roots.length) {
    const root = roots.pop()!;
    act(() => { root.unmount(); });
  }
  while (containers.length) {
    containers.pop()!.remove();
  }
});

async function renderTracked(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(element); });
  roots.push(root);
  containers.push(container);
  return container;
}

async function fireClick(el: Element) {
  await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

async function flush() {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
}

const CATEGORIES = [{ id: "CAT-007", name: "Topping" }];

async function openEditForm(product: any, canDelete?: boolean) {
  const container = await renderTracked(
    <ProductForm categories={CATEGORIES} initialData={product} canDelete={canDelete} />,
  );
  const editButton = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Sửa")!;
  await fireClick(editButton);
  await flush();
  return document.querySelector('input[type="number"]') as HTMLInputElement;
}

describe("ProductForm -- price field for a topping linked to an ACTIVE modifier", () => {
  it("is read-only for PROD-030, linked to an ACTIVE modifier, with a line saying where to edit it", async () => {
    const priceInput = await openEditForm({
      id: "PROD-030", name: "Kem muối", category_id: "CAT-007", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-030", size_name: "Mặc định", price: 4000 }],
      isLinkedTopping: true,
    });

    expect(priceInput.readOnly).toBe(true);
    expect(document.body.textContent).toContain("Topping & Tuỳ chọn");
  });

  it("stays a normal editable field for an ordinary product", async () => {
    const priceInput = await openEditForm({
      id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-001", size_name: "Mặc định", price: 25000 }],
      isLinkedTopping: false,
    });

    expect(priceInput.readOnly).toBe(false);
  });
});

// I2 (final-fix-brief.md, BR-ACCESS-003): eraseProduct is now requireOwner()
// server-side; canDelete hides the "Xoá vĩnh viễn" button as a courtesy for
// a role that would be refused anyway, same pattern as commit e41968d.
describe("ProductForm -- erase button gated by canDelete (I2)", () => {
  const NEVER_SOLD_PRODUCT = {
    id: "PROD-050", name: "Món chưa bán", category_id: "CAT-001", status: "ACTIVE",
    neverSold: true, variants: [{ id: "VAR-050", size_name: "Mặc định", price: 10000 }],
    isLinkedTopping: false,
  };

  it('shows "Xoá vĩnh viễn" for a never-sold product when canDelete is true', async () => {
    const container = await renderTracked(
      <ProductForm categories={CATEGORIES} initialData={NEVER_SOLD_PRODUCT} canDelete={true} />,
    );
    const eraseButton = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Xoá vĩnh viễn");
    expect(eraseButton).toBeTruthy();
  });

  it('hides "Xoá vĩnh viễn" for a never-sold product when canDelete is false, even though the button would otherwise show', async () => {
    const container = await renderTracked(
      <ProductForm categories={CATEGORIES} initialData={NEVER_SOLD_PRODUCT} canDelete={false} />,
    );
    const eraseButton = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Xoá vĩnh viễn");
    expect(eraseButton).toBeUndefined();
  });
});
