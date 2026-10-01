// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import ConversionsClient from "./ConversionsClient";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const ITEMS = [
  { id: "ITEM-1", name: "Sữa đặc", item_category_id: "CAT-1", base_uom: "UNT-LON", status: "ACTIVE" },
] as any;

const CONVERSIONS = [
  {
    id: "CONV-1",
    purchased_item_id: "ITEM-1",
    purchased_unit: "UNT-THUNG",
    conversion_rate: 24,
    base_unit: "UNT-LON",
    status: "ACTIVE",
  },
] as any;

const UNITS = [
  { id: "UNT-THUNG", name: "Thùng", status: "ACTIVE" },
  { id: "UNT-LON", name: "Lon", status: "ACTIVE" },
] as any;

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  push.mockClear();
});

describe("ConversionsClient list with search", () => {
  it("renders search input with initialSearch and sets Sửa returnTo with encoded query", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        canDelete={false}
        initialSearch="sữa"
      />,
    );

    const input = screen.getByPlaceholderText("Tên hàng hóa...") as HTMLInputElement;
    expect(input.value).toBe("sữa");

    const editLinks = screen.getAllByRole("link", { name: "Sửa" });
    // The list URL carries q encoded once; returnTo encodes that URL again.
    const expectedReturnTo = encodeURIComponent(`/admin/inventory/conversions?q=${encodeURIComponent("sữa")}`);
    expect(editLinks[0]).toHaveAttribute(
      "href",
      `/admin/inventory/conversions/CONV-1/edit?returnTo=${expectedReturnTo}`,
    );

    const addLink = screen.getByRole("link", { name: "+ Thêm Quy Đổi" });
    expect(addLink).toHaveAttribute(
      "href",
      `/admin/inventory/conversions/new?returnTo=${expectedReturnTo}`,
    );
  });

  it("updates URL with router.replace when typing in search input", () => {
    render(
      <ConversionsClient
        items={ITEMS}
        conversions={CONVERSIONS}
        units={UNITS}
        canDelete={false}
        initialSearch=""
      />,
    );

    const input = screen.getByPlaceholderText("Tên hàng hóa...");
    fireEvent.change(input, { target: { value: "sữa" } });
    expect(replace).toHaveBeenCalledWith("/admin/inventory/conversions?q=s%E1%BB%AFa", { scroll: false });
  });
});
