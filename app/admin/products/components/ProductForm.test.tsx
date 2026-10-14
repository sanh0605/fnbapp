// @vitest-environment jsdom
//
// BR-CATALOG-003: a
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
  routerRefresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/admin/products/actions", () => ({
  saveProduct: mocks.saveProduct,
  pauseProduct: mocks.pauseProduct,
  resumeProduct: mocks.resumeProduct,
  eraseProduct: mocks.eraseProduct,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.push }),
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

const CATEGORIES = [{ id: "CAT-007", name: "Topping" }];

async function openEditForm(product: any, canDelete?: boolean) {
  const container = await renderTracked(
    <ProductForm categories={CATEGORIES} initialData={product} canDelete={canDelete} />,
  );
  return priceBoxOf(container);
}

// Wave K4: the price box is found by its label "Giá bán", not by type="number".
function priceBoxOf(container: HTMLElement, index = 0) {
  const label = Array.from(container.querySelectorAll("label")).filter(l => l.textContent?.trim() === "Giá bán")[index];
  if (!label) throw new Error("label Giá bán not found");
  return document.getElementById(label.htmlFor) as HTMLInputElement;
}

describe("ProductForm -- price field for a topping linked to an ACTIVE modifier", () => {
  it("is read-only for PROD-030, linked to an ACTIVE modifier, with a line saying where to edit it", async () => {
    const priceInput = await openEditForm({
      id: "PROD-030", name: "Kem muối", category_id: "CAT-007", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-030", size_name: "Mặc định", price: 4000 }],
      isLinkedTopping: true,
    });

    expect(priceInput.readOnly || priceInput.disabled).toBe(true);
    expect(priceInput.value).toBe("4,000");
    expect(document.body.textContent).toContain("Topping & Tuỳ chọn");
  });

  it("stays a normal editable field for an ordinary product", async () => {
    const priceInput = await openEditForm({
      id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-001", size_name: "Mặc định", price: 25000 }],
      isLinkedTopping: false,
    });

    expect(priceInput.readOnly || priceInput.disabled).toBe(false);
  });

  // F6 (2026-10-14 audit): a linked topping has one price, so no second size.
  it("hides 'Thêm size' for a linked topping and shows it for an ordinary dish", async () => {
    await openEditForm({
      id: "PROD-030", name: "Kem muối", category_id: "CAT-007", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-030", size_name: "Mặc định", price: 4000 }],
      isLinkedTopping: true,
    });
    expect(document.body.textContent).not.toContain("Thêm size");
    await openEditForm({
      id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE",
      neverSold: false, variants: [{ id: "VAR-001", size_name: "Mặc định", price: 25000 }],
      isLinkedTopping: false,
    });
    expect(document.body.textContent).toContain("Thêm size");
  });
});

describe("ProductForm -- buttons (BR-UI-005, spec 2.1)", () => {
  it('"Xoá size" removes a size, so it wears the Xoá look: red outline, no class overrides', async () => {
    const container = await renderTracked(<ProductForm categories={CATEGORIES} />);
    const add = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.includes("Thêm size"))!;
    await fireClick(add);
    const remove = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Xoá size")!;
    expect(remove).toBeTruthy();
    const classes = remove.className.split(/\s+/);
    expect(classes).toContain("border-danger");
    expect(classes.filter(c => c.startsWith("!"))).toEqual([]);
  });
});

describe("ProductForm -- page form navigation and fields", () => {
  it("renders 'Tên món *' immediately and 'Bỏ' goes to returnTo", async () => {
    const container = await renderTracked(
      <ProductForm categories={CATEGORIES} returnTo="/admin/products?status=INACTIVE" />,
    );
    const nameInput = container.querySelector('input[placeholder*="Cà phê"]') as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    const cancelButton = Array.from(container.querySelectorAll("button")).find(b => b.textContent?.trim() === "Bỏ")!;
    await fireClick(cancelButton);
    expect(mocks.push).toHaveBeenCalledWith("/admin/products?status=INACTIVE");
  });
});

async function typeInto(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Wave K4 (BR-UI-008, BR-CASH-005, BR-UI-009): each size's price is the shared
// whole-đồng number box. The server reads Number(price), so the saved number
// is what counts, not whether it travels as "30000" or 30000.
describe("ProductForm -- price box (wave K4)", () => {
  const PROD_001 = {
    id: "PROD-001", name: "Cà phê đá", category_id: "CAT-001", status: "ACTIVE",
    neverSold: false, variants: [{ id: "VAR-001", size_name: "Mặc định", price: 25000 }],
    isLinkedTopping: false,
  };

  it("a new dish's price box is empty, takes whole đồng and groups thousands", async () => {
    const container = await renderTracked(<ProductForm categories={CATEGORIES} />);
    const box = priceBoxOf(container);
    expect(box.type).toBe("text");
    expect(box.getAttribute("inputmode")).toBe("numeric");
    expect(box.getAttribute("placeholder")).toBe("Ví dụ: 25,000");
    expect(box.value).toBe("");
    await typeInto(box, "25000");
    expect(box.value).toBe("25,000");
    expect(box.parentElement?.textContent).toContain("đ");
  });

  it("an existing price shows grouped and a change saves the new number", async () => {
    mocks.saveProduct.mockResolvedValue({ success: true });
    const container = await renderTracked(
      <ProductForm categories={[{ id: "CAT-001", name: "Cà phê" }]} initialData={PROD_001} />,
    );
    const box = priceBoxOf(container);
    expect(box.value).toBe("25,000");
    await typeInto(box, "30000");
    const save = Array.from(container.querySelectorAll("button")).find(b => /^Lưu/.test(b.textContent?.trim() ?? ""))!;
    await fireClick(save);
    expect(mocks.saveProduct).toHaveBeenCalledTimes(1);
    const fd = mocks.saveProduct.mock.calls[0][0] as FormData;
    const variants = JSON.parse(String(fd.get("variants_json")));
    expect(Number(variants[0].price)).toBe(30000);
    expect(variants[0].id).toBe("VAR-001");
  });

  it("a price left empty is not saved as 0đ: the box says Cần nhập số.", async () => {
    const container = await renderTracked(
      <ProductForm categories={[{ id: "CAT-001", name: "Cà phê" }]} initialData={PROD_001} />,
    );
    const box = priceBoxOf(container);
    await typeInto(box, "");
    const save = Array.from(container.querySelectorAll("button")).find(b => /^Lưu/.test(b.textContent?.trim() ?? ""))!;
    await fireClick(save);
    expect(mocks.saveProduct).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Cần nhập số.");
  });
});

describe("ProductForm -- option groups tick list", () => {
  it("renders option groups and appends option_group_ids to formData on save", async () => {
    mocks.saveProduct.mockResolvedValue({ success: true });
    const container = await renderTracked(
      <ProductForm
        categories={[{ id: "CAT-001", name: "Cà phê" }]}
        optionGroups={[
          { id: "MG-001", name: "Thêm Topping", status: "ACTIVE" },
          { id: "MG-002", name: "Mức đường", status: "ACTIVE" },
        ]}
        selectedOptionGroupIds={["MG-001"]}
      />,
    );
    expect(container.textContent).toContain("Nhóm tuỳ chọn");
    const toppingCheckbox = container.querySelector('input[value="MG-001"]') as HTMLInputElement;
    const sugarCheckbox = container.querySelector('input[value="MG-002"]') as HTMLInputElement;
    expect(toppingCheckbox.checked).toBe(true);
    expect(sugarCheckbox.checked).toBe(false);

    // Tick sugar checkbox
    await fireClick(sugarCheckbox);
    expect(sugarCheckbox.checked).toBe(true);

    // Fill required fields and save
    const nameInput = container.querySelector('input[placeholder*="Cà phê"]') as HTMLInputElement;
    await typeInto(nameInput, "Cà phê đen");
    const categorySelect = container.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      categorySelect.value = "CAT-001";
      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const priceBox = priceBoxOf(container);
    await typeInto(priceBox, "20000");

    const save = Array.from(container.querySelectorAll("button")).find((b) => /^Lưu/.test(b.textContent?.trim() ?? ""))!;
    await fireClick(save);

    expect(mocks.saveProduct).toHaveBeenCalled();
    const fd = mocks.saveProduct.mock.calls[0][0] as FormData;
    expect(fd.get("option_group_ids_sent")).toBe("1");
    expect(fd.getAll("option_group_ids")).toEqual(["MG-001", "MG-002"]);
  });
});

