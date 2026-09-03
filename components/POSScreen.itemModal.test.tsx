// @vitest-environment jsdom
//
// Characterisation tests for the item-configuration modal inside
// components/POSScreen.tsx (JSX at lines 1133-1283, driven by openProductModal
// at 300, addModifier at 323, removeModifier at 327, addToCart at 336, and the
// derived price block at 381-406). Plan F, task F1.
//
// The modal has no standalone export -- it is inline JSX gated on the
// `selectedProduct` state of POSScreen, reachable only by rendering POSScreen
// and clicking a product tile (or a cart line, for edit mode). Every test
// here renders the real POSScreen component and drives it through the DOM, no
// shortcuts through internal state.
//
// Order-level promo code and custom discount (promoCodeInput, appliedPromoCode,
// manualPromoError, userCustomDiscount, userCustomDiscountType) are out of
// scope -- they belong to CartPanel and the checkout path, per the plan's
// correction in section 1.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import React from "react";
import POSScreen from "./POSScreen";
import { formatNumber } from "@/lib/format";

// POSScreen imports these from "@/app/pos/actions" (a "use server" file that
// transitively pulls in next/cache, lib/sheets_db, lib/auth, etc.). None of
// them run during these tests -- brandId is omitted below so the drafts
// effect (refreshDrafts -> getPOSDrafts) short-circuits before it would call
// out -- but the module is still imported and evaluated when POSScreen.tsx
// loads. Mocking keeps the test hermetic instead of relying on nothing at
// that module's top level throwing.
vi.mock("@/app/pos/actions", () => ({
  submitOrderV2: vi.fn(),
  getPOSDrafts: vi.fn(async () => []),
  savePOSDraft: vi.fn(),
  deletePOSDraft: vi.fn(),
  reportPosSyncFailure: vi.fn(),
}));

// POSScreen calls listPendingOrders() unconditionally on mount (the offline
// sync sweep). Its real implementation opens IndexedDB, which jsdom does not
// implement; POSScreen's own try/catch would swallow the resulting rejection
// silently, but relying on that incidental behaviour is fragile. Mocked
// instead so the sweep is a hermetic no-op.
vi.mock("@/lib/pos-offline-queue", () => ({
  enqueuePendingOrder: vi.fn(),
  incrementAttemptCount: vi.fn(),
  listPendingOrders: vi.fn(async () => []),
  removePendingOrder: vi.fn(),
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

// Every interaction is wrapped in act() so React flushes the resulting state
// update before the next query -- without it, DOM queries right after a
// dispatchEvent race the update and see stale markup.
async function fireClick(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickButtonWithText(text: string) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.trim() === text,
  );
  if (!btn) throw new Error(`button not found: "${text}"`);
  await fireClick(btn);
}

async function clickElementContainingText(tag: string, text: string) {
  const el = Array.from(document.querySelectorAll(tag)).find(
    e => e.textContent?.trim() === text,
  );
  if (!el) throw new Error(`${tag} not found containing: "${text}"`);
  await fireClick(el);
}

async function openProductByName(name: string) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.includes(name),
  );
  if (!btn) throw new Error(`product tile not found: "${name}"`);
  await fireClick(btn);
}

function addToCartButton(): HTMLButtonElement {
  const btn = Array.from(document.querySelectorAll("button")).find(
    b => b.textContent?.startsWith("THÊM") || b.textContent?.startsWith("CẬP NHẬT"),
  );
  if (!btn) throw new Error("add/update button not found");
  return btn as HTMLButtonElement;
}

function modifierRow(modName: string): HTMLElement {
  const nameSpan = Array.from(document.querySelectorAll("span")).find(
    s => s.textContent === modName,
  );
  if (!nameSpan) throw new Error(`modifier row not found: "${modName}"`);
  // span -> "flex flex-col" name block -> row div (name block + button block)
  return nameSpan.parentElement!.parentElement as HTMLElement;
}

function modifierButtons(modName: string) {
  const row = modifierRow(modName);
  const buttons = Array.from(row.querySelectorAll("button"));
  const minusBtn = buttons.find(b => b.textContent?.trim() === "-")!;
  const plusBtn = buttons.find(b => b.textContent?.trim() === "+")!;
  const countSpan = Array.from(row.querySelectorAll("span")).find(
    s => /^\d+$/.test(s.textContent?.trim() || ""),
  )!;
  return { minusBtn, plusBtn, countSpan };
}

function qtyControls() {
  const box = Array.from(document.querySelectorAll("div")).find(d =>
    d.className.includes("bg-surface-secondary rounded-xl p-1.5"),
  );
  if (!box) throw new Error("quantity control box not found");
  const buttons = Array.from(box.querySelectorAll("button"));
  const minusBtn = buttons.find(b => b.textContent?.trim() === "-")!;
  const plusBtn = buttons.find(b => b.textContent?.trim() === "+")!;
  const qtySpan = box.querySelector("span") as HTMLElement;
  return { minusBtn, plusBtn, qtySpan };
}

function discountInput(): HTMLInputElement {
  const input = document.querySelector('input[aria-label="Giảm giá sản phẩm"]');
  if (!input) throw new Error("discount input not found");
  return input as HTMLInputElement;
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function gocText(): string | undefined {
  return Array.from(document.querySelectorAll("div")).find(d =>
    d.textContent?.trim().startsWith("Gốc:"),
  )?.textContent;
}

// --- Fixtures -----------------------------------------------------------

const CATEGORY = { id: "CAT1", name: "Cà phê" };

function makeProduct(id: string, name: string) {
  return { id, name, category_id: CATEGORY.id };
}

// --- Tests ----------------------------------------------------------------

describe("POSScreen item-configuration modal", () => {
  it("variant selection changes the total shown on the add button", async () => {
    const product = makeProduct("P1", "Cà phê sữa");
    const variants = [
      { id: "V1", product_id: "P1", size_name: "Nhỏ", price: 25000 },
      { id: "V2", product_id: "P1", size_name: "Lớn", price: 35000 },
    ];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={[]}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    expect(addToCartButton().textContent).toContain(formatNumber(25000));

    await clickElementContainingText("span", "Lớn");
    expect(addToCartButton().textContent).toContain(formatNumber(35000));
  });

  it("a modifier with a price adds it, the counter tracks repeats, and minus is disabled at zero", async () => {
    const product = makeProduct("P1", "Trà đào");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 20000 }];
    const modifiers = [{ id: "M1", group_name: "Topping", name: "Trân châu", price: 5000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={modifiers}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    let { minusBtn, plusBtn, countSpan } = modifierButtons("Trân châu");

    expect(countSpan.textContent).toBe("0");
    expect(minusBtn.disabled).toBe(true);
    expect(addToCartButton().textContent).toContain(formatNumber(20000));

    await fireClick(plusBtn);
    ({ minusBtn, plusBtn, countSpan } = modifierButtons("Trân châu"));
    expect(countSpan.textContent).toBe("1");
    expect(minusBtn.disabled).toBe(false);
    expect(addToCartButton().textContent).toContain(formatNumber(25000));

    await fireClick(plusBtn);
    ({ minusBtn, plusBtn, countSpan } = modifierButtons("Trân châu"));
    expect(countSpan.textContent).toBe("2");
    expect(addToCartButton().textContent).toContain(formatNumber(30000));

    await fireClick(minusBtn);
    ({ minusBtn, plusBtn, countSpan } = modifierButtons("Trân châu"));
    expect(countSpan.textContent).toBe("1");
    expect(minusBtn.disabled).toBe(false);

    await fireClick(minusBtn);
    ({ minusBtn, plusBtn, countSpan } = modifierButtons("Trân châu"));
    expect(countSpan.textContent).toBe("0");
    expect(minusBtn.disabled).toBe(true);
    expect(addToCartButton().textContent).toContain(formatNumber(20000));
  });

  it("quantity multiplies base price plus modifiers, and the minus button floors at 1", async () => {
    const product = makeProduct("P1", "Cà phê đen");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 18000 }];
    const modifiers = [{ id: "M1", group_name: "Topping", name: "Sữa", price: 2000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={modifiers}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    await fireClick(modifierButtons("Sữa").plusBtn);
    // base per unit = 18000 + 2000 = 20000

    expect(qtyControls().qtySpan.textContent).toBe("1");

    await fireClick(qtyControls().minusBtn);
    expect(qtyControls().qtySpan.textContent).toBe("1");
    expect(addToCartButton().textContent).toContain(formatNumber(20000));

    await fireClick(qtyControls().plusBtn);
    expect(qtyControls().qtySpan.textContent).toBe("2");
    expect(addToCartButton().textContent).toContain(formatNumber(40000));

    await fireClick(qtyControls().plusBtn);
    expect(qtyControls().qtySpan.textContent).toBe("3");
    expect(addToCartButton().textContent).toContain(formatNumber(60000));
  });

  it("item discount applies as a flat VND amount", async () => {
    const product = makeProduct("P1", "Nước cam");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 30000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={[]}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    await setInputValue(discountInput(), "5000");

    expect(addToCartButton().textContent).toContain(formatNumber(25000));
    expect(gocText()).toContain(formatNumber(30000));
  });

  it("item discount applies as a percent of the base total", async () => {
    const product = makeProduct("P1", "Nước chanh");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 40000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={[]}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    await clickButtonWithText("%");
    await setInputValue(discountInput(), "10");

    // 40000 * 10% = 4000 off
    expect(addToCartButton().textContent).toContain(formatNumber(36000));
    expect(gocText()).toContain(formatNumber(40000));
  });

  describe("automatic per-variant promo", () => {
    const product = makeProduct("P1", "Trà sữa");
    const variants = [
      { id: "V-PERCENT", product_id: "P1", size_name: "Percent", price: 40000 },
      { id: "V-FLAT-PRICE", product_id: "P1", size_name: "FlatPrice", price: 50000 },
      { id: "V-FLAT-VND", product_id: "P1", size_name: "FlatVnd", price: 45000 },
      { id: "V-FLAT-PRICE-FLOOR", product_id: "P1", size_name: "FlatPriceFloor", price: 20000 },
    ];
    const promotions = [
      {
        id: "PROMO-PERCENT",
        status: "ACTIVE",
        type: "PRODUCT_DISCOUNT",
        start_date: "2020-01-01",
        end_date: null,
        discount_type: "PERCENT",
        discount_value: 20,
        applicable_products_json: JSON.stringify(["V-PERCENT"]),
      },
      {
        id: "PROMO-FLAT-PRICE",
        status: "ACTIVE",
        type: "PRODUCT_DISCOUNT",
        start_date: "2020-01-01",
        end_date: null,
        discount_type: "FLAT_PRICE",
        discount_value: 30000,
        applicable_products_json: JSON.stringify(["V-FLAT-PRICE"]),
      },
      {
        id: "PROMO-FLAT-VND",
        status: "ACTIVE",
        type: "PRODUCT_DISCOUNT",
        start_date: "2020-01-01",
        end_date: null,
        discount_type: "FLAT_VND",
        discount_value: 10000,
        applicable_products_json: JSON.stringify(["V-FLAT-VND"]),
      },
      {
        id: "PROMO-FLAT-PRICE-FLOOR",
        status: "ACTIVE",
        type: "PRODUCT_DISCOUNT",
        start_date: "2020-01-01",
        end_date: null,
        discount_type: "FLAT_PRICE",
        discount_value: 25000, // above the variant's own 20000 price
        applicable_products_json: JSON.stringify(["V-FLAT-PRICE-FLOOR"]),
      },
    ];

    it("PERCENT promo: base * val% * qty", async () => {
      await renderTracked(
        <POSScreen
          categories={[CATEGORY]}
          products={[product]}
          variants={variants}
          modifiers={[]}
          promotions={promotions}
          bestSellers={[product.id]}
        />,
      );
      await openProductByName(product.name);
      await clickElementContainingText("span", "Percent");
      await fireClick(qtyControls().plusBtn); // qty = 2

      // base = 40000 * 2 = 80000; promo = 80000 * 20% = 16000; final = 64000
      expect(addToCartButton().textContent).toContain(formatNumber(64000));
      expect(gocText()).toContain(formatNumber(80000));
    });

    it("FLAT_PRICE promo: (unit price - promo price, floored at 0) * qty", async () => {
      await renderTracked(
        <POSScreen
          categories={[CATEGORY]}
          products={[product]}
          variants={variants}
          modifiers={[]}
          promotions={promotions}
          bestSellers={[product.id]}
        />,
      );
      await openProductByName(product.name);
      await clickElementContainingText("span", "FlatPrice");
      await fireClick(qtyControls().plusBtn); // qty = 2

      // base = 50000 * 2 = 100000; per-unit discount = 50000 - 30000 = 20000; promo = 20000 * 2 = 40000; final = 60000
      expect(addToCartButton().textContent).toContain(formatNumber(60000));
      expect(gocText()).toContain(formatNumber(100000));
    });

    it("flat amount (FLAT_VND) promo: val * qty", async () => {
      await renderTracked(
        <POSScreen
          categories={[CATEGORY]}
          products={[product]}
          variants={variants}
          modifiers={[]}
          promotions={promotions}
          bestSellers={[product.id]}
        />,
      );
      await openProductByName(product.name);
      await clickElementContainingText("span", "FlatVnd");
      await fireClick(qtyControls().plusBtn); // qty = 2

      // base = 45000 * 2 = 90000; promo = 10000 * 2 = 20000; final = 70000
      expect(addToCartButton().textContent).toContain(formatNumber(70000));
      expect(gocText()).toContain(formatNumber(90000));
    });

    it("FLAT_PRICE promo floors the per-unit discount at 0 when the promo price exceeds the variant price", async () => {
      await renderTracked(
        <POSScreen
          categories={[CATEGORY]}
          products={[product]}
          variants={variants}
          modifiers={[]}
          promotions={promotions}
          bestSellers={[product.id]}
        />,
      );
      await openProductByName(product.name);
      await clickElementContainingText("span", "FlatPriceFloor");

      // per-unit discount = max(0, 20000 - 25000) = 0; final = base, unchanged
      expect(addToCartButton().textContent).toContain(formatNumber(20000));
      // no discount applied at all -> no strike-through line
      expect(gocText()).toBeUndefined();
    });
  });

  it('"Gốc:" appears only when a manual or promo discount is greater than zero', async () => {
    const product = makeProduct("P1", "Sinh tố");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 22000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={[]}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    expect(gocText()).toBeUndefined();

    await setInputValue(discountInput(), "1000");
    expect(gocText()).toContain(formatNumber(22000));
  });

  it("the final total floors at 0 when a discount exceeds the base total", async () => {
    const product = makeProduct("P1", "Trà tắc");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 10000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={[]}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    await setInputValue(discountInput(), "999999");

    expect(addToCartButton().textContent).toContain(formatNumber(0));
    expect(gocText()).toContain(formatNumber(10000));
  });

  it("edit mode pre-fills variant, modifiers, qty and discount from the existing cart line, and the button reads CẬP NHẬT", async () => {
    const product = makeProduct("P1", "Cà phê muối");
    const variants = [
      { id: "V1", product_id: "P1", size_name: "Nhỏ", price: 25000 },
      { id: "V2", product_id: "P1", size_name: "Lớn", price: 35000 },
    ];
    const modifiers = [{ id: "M1", group_name: "Topping", name: "Đá", price: 1000 }];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={modifiers}
        bestSellers={[product.id]}
      />,
    );

    // Configure and add a line: Lớn, +1 modifier, qty 2, 10% discount.
    await openProductByName(product.name);
    await clickElementContainingText("span", "Lớn");
    await fireClick(modifierButtons("Đá").plusBtn);
    await fireClick(qtyControls().plusBtn); // qty = 2
    await clickButtonWithText("%");
    await setInputValue(discountInput(), "10");
    expect(addToCartButton().textContent?.startsWith("THÊM")).toBe(true);
    await fireClick(addToCartButton());

    // Modal closed after add.
    expect(document.querySelector('input[aria-label="Giảm giá sản phẩm"]')).toBeNull();

    // Reopen via the cart line (edit mode).
    await clickElementContainingText("h4", product.name);

    expect(addToCartButton().textContent?.startsWith("CẬP NHẬT")).toBe(true);
    expect(qtyControls().qtySpan.textContent).toBe("2");
    expect(modifierButtons("Đá").countSpan.textContent).toBe("1");
    expect(discountInput().value).toBe("10");
    // discount type restored to PERCENT: base (35000+1000)*2=72000, 10% off = 7200 -> 64800
    expect(addToCartButton().textContent).toContain(formatNumber(64800));
    expect(gocText()).toContain(formatNumber(72000));
  });

  it("composes variant + two modifiers + qty 3 + PERCENT discount + an active variant promo into one exact number", async () => {
    const product = makeProduct("P1", "Bạc xỉu");
    const variants = [{ id: "V1", product_id: "P1", size_name: "M", price: 20000 }];
    const modifiers = [
      { id: "M1", group_name: "Topping", name: "Trân châu", price: 3000 },
      { id: "M2", group_name: "Topping", name: "Thạch", price: 2000 },
    ];
    const promotions = [
      {
        id: "PROMO1",
        status: "ACTIVE",
        type: "PRODUCT_DISCOUNT",
        start_date: "2020-01-01",
        end_date: null,
        discount_type: "PERCENT",
        discount_value: 5,
        applicable_products_json: JSON.stringify(["V1"]),
      },
    ];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[product]}
        variants={variants}
        modifiers={modifiers}
        promotions={promotions}
        bestSellers={[product.id]}
      />,
    );

    await openProductByName(product.name);
    await fireClick(modifierButtons("Trân châu").plusBtn);
    await fireClick(modifierButtons("Thạch").plusBtn);
    await fireClick(qtyControls().plusBtn);
    await fireClick(qtyControls().plusBtn); // qty = 3
    await clickButtonWithText("%");
    await setInputValue(discountInput(), "10");

    // base per unit = 20000 + 3000 + 2000 = 25000; base total = 75000
    // manual = 75000 * 10% = 7500; promo = 75000 * 5% = 3750
    // final = 75000 - 7500 - 3750 = 63750
    expect(addToCartButton().textContent).toContain(formatNumber(63750));
    expect(gocText()).toContain(formatNumber(75000));
  });

  // Plan F, F2b. F2's own pre-code verification concluded a second
  // openProductModal call while the modal is already open "is not reachable
  // through any code path" -- true for the mouse (the backdrop is z-50 and
  // opaque) but not for the keyboard: the modal traps no focus and sets no
  // role (OPEN-ITEMS 40), so the product tiles behind it stay in the tab
  // order. Tab to a tile, press Enter, and this fires while the modal is
  // still mounted.
  //
  // Before F2, openProductModal re-initialised the five item state vars
  // itself. After F2, <ItemConfigModal> reconciles in place on a second
  // call (same type, same position, no key) -- its useState initialisers
  // only ran once, at first mount, so it kept product A's variant/qty under
  // product B's name and price. Measured directly: this test fails against
  // c750c5d (post-F2, no key) and passes against both e8dcd11 (pre-F2) and
  // post-F2 with the key restored below.
  it("F2b regression: activating a second product's tile without closing resets the modal instead of keeping the first product's quantity", async () => {
    const productA = makeProduct("P1", "Cà phê sữa");
    const productB = makeProduct("P2", "Trà đào");
    const variants = [
      { id: "VA", product_id: "P1", size_name: "M", price: 20000 },
      { id: "VB", product_id: "P2", size_name: "M", price: 15000 },
    ];

    await renderTracked(
      <POSScreen
        categories={[CATEGORY]}
        products={[productA, productB]}
        variants={variants}
        modifiers={[]}
        bestSellers={[productA.id, productB.id]}
      />,
    );

    await openProductByName(productA.name);
    await fireClick(qtyControls().plusBtn);
    await fireClick(qtyControls().plusBtn); // qty = 3
    expect(qtyControls().qtySpan.textContent).toBe("3");

    // Product B's tile is still in the DOM behind the modal -- a real mouse
    // click cannot reach it (opaque backdrop), but a dispatched click
    // reaches the handler regardless of stacking in jsdom, the same entry
    // point OPEN-ITEMS 40's missing focus trap leaves open to the keyboard.
    await openProductByName(productB.name);

    expect(qtyControls().qtySpan.textContent).toBe("1");
    expect(addToCartButton().textContent).toContain(formatNumber(15000));
  });
});
