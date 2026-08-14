// @vitest-environment jsdom
//
// Render tests for the recipe picker inside components/ProductForm.tsx
// (OPEN-ITEMS 42). The picker is a custom combobox (components/
// SearchableSelect.tsx), not a native <select> -- its options render as
// <li role="option"> only once the dropdown is opened, and only into
// document.body (ModalPortal). A test that greps source text cannot see
// this; that exact blindness is OPEN-ITEMS 38. Every test here renders the
// real component and drives it through the DOM.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import ProductForm from "./ProductForm";

vi.mock("@/app/admin/products/actions", () => ({
  saveProduct: vi.fn(),
  deleteProduct: vi.fn(),
}));

// ProductForm renders CustomDatePicker (react-datepicker) unconditionally
// inside its modal; that component calls window.matchMedia in a mount
// effect, which jsdom does not implement. Not related to the recipe
// picker under test -- stubbed so the surrounding form can mount at all.
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

// SearchableSelect scrolls the highlighted option into view when the
// dropdown opens; jsdom does not implement scrollIntoView at all.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

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

async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

// ModalPortal renders its children only after its own mount effect fires --
// one extra tick beyond the triggering click.
async function flush() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function comboboxTrigger(): HTMLElement {
  const el = document.querySelector('[role="combobox"]');
  if (!el) throw new Error("combobox trigger not found");
  return el as HTMLElement;
}

function openOptionTexts(): string[] {
  return Array.from(document.querySelectorAll('li[role="option"]')).map(li => li.textContent || "");
}

const CATEGORIES = [{ id: "C1", name: "Cà phê" }];
const UNITS = [{ id: "U1", name: "g" }];

const BASE_INGREDIENTS = [
  { id: "ING-ACTIVE", name: "Sữa tươi", base_unit: "U1", status: "ACTIVE", current_mac: 100 },
  { id: "ING-INACTIVE", name: "Sữa yến mạch cũ", base_unit: "U1", status: "INACTIVE", current_mac: 50 },
];

const SEMI_PRODUCTS = [
  { id: "SP-ACTIVE", name: "Trân châu nấu sẵn", base_unit: "U1", status: "ACTIVE", current_mac: 30 },
  { id: "SP-INACTIVE", name: "Thạch cũ", base_unit: "U1", status: "INACTIVE", current_mac: 20 },
];

describe("ProductForm recipe picker (OPEN-ITEMS 42)", () => {
  it("a fresh (unreferenced) ingredient row offers only ACTIVE base ingredients, not the INACTIVE one", async () => {
    await renderTracked(
      <ProductForm categories={CATEGORIES} baseIngredients={BASE_INGREDIENTS} semiProducts={SEMI_PRODUCTS} units={UNITS} />,
    );

    // Open the "add product" form.
    const openBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm Món Mới"))!;
    await fireClick(openBtn);
    await flush();

    // Add an ingredient row to the default variant.
    const addIngredientBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm Nguyên Liệu"))!;
    await fireClick(addIngredientBtn);

    // Open the picker for that row (defaults to BASE_INGREDIENT).
    await fireClick(comboboxTrigger());

    const options = openOptionTexts();
    expect(options.some(t => t.includes("Sữa tươi"))).toBe(true);
    expect(options.some(t => t.includes("Sữa yến mạch cũ"))).toBe(false);
  });

  it("a fresh (unreferenced) ingredient row offers only ACTIVE semi-products, not the INACTIVE one", async () => {
    await renderTracked(
      <ProductForm categories={CATEGORIES} baseIngredients={BASE_INGREDIENTS} semiProducts={SEMI_PRODUCTS} units={UNITS} />,
    );

    const openBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm Món Mới"))!;
    await fireClick(openBtn);
    await flush();

    const addIngredientBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm Nguyên Liệu"))!;
    await fireClick(addIngredientBtn);

    // Switch the row's type to SEMI_PRODUCT.
    // Scoped by its own option text -- CustomDatePicker's month/year
    // navigation also renders native <select> elements once open, so a bare
    // document.querySelector("select") is ambiguous.
    const typeSelect = Array.from(document.querySelectorAll("select")).find(s =>
      Array.from(s.options).some(o => o.textContent === "Bán thành phẩm"),
    ) as HTMLSelectElement;
    if (!typeSelect) throw new Error("ingredient type select not found");
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")!.set!;
      nativeSetter.call(typeSelect, "SEMI_PRODUCT");
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await fireClick(comboboxTrigger());

    const options = openOptionTexts();
    expect(options.some(t => t.includes("Trân châu nấu sẵn"))).toBe(true);
    expect(options.some(t => t.includes("Thạch cũ"))).toBe(false);
  });

  it("a row that already references a now-INACTIVE ingredient still shows it, tagged as retired -- not an empty select", async () => {
    const initialData = {
      id: "PROD-1",
      category_id: "C1",
      name: "Trà sữa cũ",
      variants: [
        {
          id: "V1",
          size_name: "M",
          price: 20000,
          ingredients: [{ ingredient_id: "ING-INACTIVE", ingredient_type: "BASE_INGREDIENT", quantity: 5 }],
        },
      ],
    };

    await renderTracked(
      <ProductForm categories={CATEGORIES} baseIngredients={BASE_INGREDIENTS} semiProducts={SEMI_PRODUCTS} units={UNITS} initialData={initialData} />,
    );

    const editBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "Sửa")!;
    await fireClick(editBtn);
    await flush();

    // The trigger itself already shows the selected (retired) option's
    // label before the dropdown is even opened -- not blank.
    expect(comboboxTrigger().textContent).toContain("Sữa yến mạch cũ");
    expect(comboboxTrigger().textContent).toContain("Ngừng dùng");

    await fireClick(comboboxTrigger());
    const options = openOptionTexts();
    // The referenced INACTIVE ingredient is present and tagged...
    expect(options.some(t => t.includes("Sữa yến mạch cũ") && t.includes("Ngừng dùng"))).toBe(true);
    // ...alongside the normal ACTIVE ones, not instead of them.
    expect(options.some(t => t.includes("Sữa tươi"))).toBe(true);
  });
});
