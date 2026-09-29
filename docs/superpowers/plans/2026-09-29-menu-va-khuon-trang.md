# Bước 2–3: menu 7 nhóm và khuôn trang chung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the admin screens behind the settled 7-group menu (desktop sidebar that collapses, phone bottom bar with a "Thêm" sheet), switch the whole app to the Cà phê palette and Be Vietnam Pro, and rebuild the Phiếu nhập list as the first page on the shared list template (20 per page, newest slip first, dates `dd/mm/yyyy HH:mm:ss`).

**Architecture:**
- The menu becomes data in one file (`app/admin/nav-items.ts`). The sidebar, phone bar and "Thêm" sheet all read that file, and so does the nav guard test.
- Colours change by repointing the existing CSS variables in `app/globals.css`, not by rewriting the 1.851 class uses.
- The Phiếu nhập list gets a pure server-side function (`lib/purchasing/purchase-order-list.ts`) that filters, sorts and cuts one page. The page sends the phone or computer only those 20 rows.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind with CSS-variable tokens, `next/font/google`, lucide-react, react-datepicker (through `components/ui/CustomDatePicker.tsx`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md`. Owner approved it on 2026-09-29 ("Duyệt"). Interview record: `docs/superpowers/specs/2026-09-28-cai-to-he-thong.md`.

**Who codes (owner, 2026-09-28):**
- **Part A, Tasks 1–3, goes to Sonnet 5** (Agent tool, model `sonnet`): `lib/`, server action, and their tests.
- **Part B, Tasks 4–8, goes to Gemini 3.1 Pro** through `agy --model gemini-3.1-pro-high -p "<task>"`: menu, colours, font, list screen.
- Opus reviews each part before it is reported done.
- Part A lands first, because Task 8 consumes it.

## Hiện trạng

1. **Trạng thái.**
   - Menu today:
     - The group of the current page opens itself (`app/admin/layout.tsx`, `navItems`, 8 groups).
     - On a phone the menu slides in from the ☰ button (`isSidebarOpen`).
     - From 768px the menu is always shown and cannot collapse.
   - After this plan:
     - **Collapsed / expanded** on desktop and iPad, remembered per device in `localStorage` under the key `fnb.sidebarCollapsed`. Anything unreadable counts as expanded.
     - **"Thêm" sheet** open or closed on phones.
     - The ☰ state is removed.
   - Phiếu nhập keep their two statuses, `DRAFT` ("Nháp") and `COMPLETED` ("Hoàn thành"); this plan does not touch status.
2. **Nút.**
   - "Mở máy bán hàng":
     - Always shown. At the top of the sidebar; as an icon only when collapsed.
     - Rightmost on the phone bar, as a raised dark round button.
     - Opens the existing `PosOutletPicker` modal.
   - Nút thu gọn: only from 768px.
   - Nút "Thêm": only under 768px.
   - "Tạo phiếu nhập": shown to everyone who can open the list, the same as today. Every purchase-order action already calls `requireAdmin()`, and this plan changes no permission.
   - "Lọc" and "Xoá lọc" on the list. "Xoá lọc" shows only when at least one filter is set.
   - Pagination: "Trước" is disabled on page 1; "Sau" is disabled on the last page.
3. **Danh sách.**
   - The menu lists every page in spec §2. Left out, with a reason in `app/admin/nav-allowlist.ts`:
     - `/admin/clear-cache`: saves already refresh the data; kept as a fallback.
     - `/admin/inventory/conversions`: opened from the Hàng hoá page.
     - The 4 existing entries stay.
   - The Phiếu nhập list contains every purchase order, draft and completed alike.
   - Order: `transaction_date` newest first, then `created_at` newest first, then `id` descending. The `id` step keeps the order stable when two slips share both times.
4. **Ô nhập.**
   - Tìm kiếm:
     - Takes any text; trimmed, then cut to 100 characters.
     - Matches case-insensitively, as today. No accent folding.
     - Matches the slip code, supplier name, supplier invoice code, or any item name on the slip.
   - Từ ngày / Đến ngày:
     - Typed or picked as `dd/mm/yyyy`.
     - An invalid day (31/02/2026, letters) shows "Ngày không hợp lệ" and does not filter.
     - Từ after Đến shows "Ngày bắt đầu phải trước ngày kết thúc" and does not filter.
   - Trạng thái: Tất cả / Nháp / Hoàn thành. Nhà cung cấp: Tất cả or one supplier.
   - `?page=` in the URL:
     - Anything not a positive whole number reads as 1.
     - A page beyond the last reads as the last page.
5. **Phục vụ dữ liệu nào.**
   - Display only: menu, colours, font, date format, and the Phiếu nhập list.
   - Deliberately untouched:
     - Every figure, costing, stock, the POS order flow.
     - The 34 tables. No migration, no production write.
     - Every other list page. They adopt the template in step 4.

**Câu hỏi riêng cho việc này:**

6. **What reads the old menu?**
   - `app/admin/nav-guard.test.ts` reads the source of `app/admin/layout.tsx` through `extractNavHrefs`. Task 2 repoints it to `app/admin/nav-items.ts`.
   - Nothing else imports `navItems`; it is local to the component.
7. **What reads `getPurchaseOrdersData`?** Only `app/admin/inventory/purchase-orders/page.tsx`. Its `lines` and `items` are still needed there after this plan: the page loads them server-side for the search.
8. **Does the POS need a service-worker change?** No. `public/pos-sw.js` behaves like this:
   - The `/pos` page itself is fetched from the network first and falls back to the cache.
   - `/_next/static/` files are cache-first by URL, and a changed file gets a new hashed URL.
   - The new CSS and font files therefore arrive on the first online load after deploy.

   Task 5 checks this by eye, including the offline case.

**Đã xem:**
- `app/admin/layout.tsx`, `app/admin/nav-allowlist.ts`, `app/admin/nav-guard.test.ts`, `lib/shared/nav-completeness.ts`
- `lib/shared/datetime.ts`, `lib/shared/report-time.ts`, `lib/shared/use-filter-form.ts`
- `app/admin/inventory/purchase-orders/page.tsx`, `actions.ts`, `components/PurchaseOrdersClient.tsx`
- `app/admin/orders/actions.ts` (existing paginated query)
- `app/globals.css`, `app/globals.test.ts`, `tailwind.config.ts`, `app/layout.tsx`
- `components/ui/CustomDatePicker.tsx`, `app/admin/reports/components/CategoryPieChart.tsx`, `app/pos/components/ProductGrid.tsx`
- `public/pos-sw.js`, `types/db.ts` (`DBPurchaseOrder`)
- Every `<h1>` and `PageHeader title=` under `app/admin`

**Chưa xem:**
- The bodies of the report pages beyond their colour classes.
- `components/ui/DateRangeFilter.tsx` internals.
- How each client component outside `app/admin/inventory/purchase-orders` lays out its heading. Task 7's test finds these by text.

**Ví dụ tính sẵn bằng số thật** (measured 2026-09-29, 191 purchase orders; re-measure in Task 3):

| Vị trí | Mã phiếu | Ngày nhập hiện | `transaction_date` lưu | Nhà cung cấp | Nguồn mua | Tổng |
|---|---|---|---|---|---|---|
| 1 | PO-191 | 28/09/2026 16:13:06 | 2026-09-28T09:13:06Z | Không rõ | Mua ngoài | 165.000đ |
| 2 | PO-190 | 24/09/2026 14:03:37 | 2026-09-24T07:03:37Z | Vinamilk | Mua ngoài | 54.864đ |
| 4 | PO-188 | 23/09/2026 00:00:00 | 2026-09-22T17:00:00Z | Không rõ | Mua ngoài | 300.000đ |
| 20 | PO-163 | 04/09/2026 00:00:00 | 2026-09-03T17:00:00Z | | | |

- Filter "Từ 23/09/2026" must keep PO-188. Today it drops it: `new Date("2026-09-23")` is 07:00 in Saigon.
- The footer on page 1 reads "1–20 trên 191 phiếu".

## Global Constraints

- Palette, fixed in code (owner, Q8b):
  - bg `#F7F5F0`, card `#FFFFFF`
  - text `#1F1B16`, muted `#5E574E`, border `#E4DFD5`
  - primary `#8A5A1F`, primary-soft `#F2E8D8`
  - red `#B3261E`
- One font everywhere, POS included: Be Vietnam Pro, self-hosted through `next/font/google`, subsets `vietnamese` and `latin`, weights 400/500/600/700.
- Dates outside filters: `dd/mm/yyyy HH:mm:ss`, Saigon time. A day-only value shows `00:00:00`. Filters pick whole days as `dd/mm/yyyy` (`BR-DATA-006`).
- No route changes. Every existing URL keeps working.
- Code and comments in English. Every visible word in Vietnamese.
- Two layouts: desktop from 768px (`md:`), phone below it. A page is done only when both work (`.claude/rules/ui-devices.md`).
- Import rules:
  - Same-folder imports are relative (`./X`).
  - Cross-folder imports use `@/`.
  - No new file at the root of `lib/`.
- Do not delete dead code met on the way; list it in the task report instead. Known cases:
  - `.bento-card` in `app/globals.css` (0 uses).
  - `/admin/products/toppings` redirect.
- Gates before a task is reported done:
  - `npx tsc --noEmit`
  - `npx vitest run`
  - `npm run build`
  - After touching docs, also `npx vite-node scripts/check-rules-current.ts` and `npx vite-node scripts/doc-checks/run-blocking.ts`.
- Nothing is pushed or deployed. Opus asks the owner separately.

## Review Focus

1. **Midnight slips at the edge of a filter.**
   - "Từ 23/09/2026" must include PO-188 (stored `2026-09-22T17:00:00Z`).
   - "Đến 22/09/2026" must exclude it.
   - Test in Task 2.
2. **A slip with no supplier row or no source row.** PO-191's supplier is the literal supplier "Không rõ", but a deleted or missing `supplier_id` must render "—", not crash or print an id. Test in Task 2.
3. **A stale `localStorage` value or blocked storage** (private window). The sidebar must render expanded and must not throw. Owned by Task 6, which wraps reads and writes in try/catch; Opus checks it with playwright in a private context.
4. **A long supplier name** ("CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ THẾ KỶ XANH", PO-181) must truncate with "…" in the table and wrap to two lines at most on the phone card, without a sideways page scroll at 375px. Checked in Task 8.
5. **`?page=abc`, `?page=0`, `?page=999`.** These read as page 1, page 1 and the last page, never as an empty list with a broken footer. Test in Task 2.

---

# Part A — Sonnet

### Task 1: Date display and day-input helpers

**Files:**
- Modify: `lib/shared/datetime.ts`
- Test: `lib/shared/datetime.test.ts`

**Interfaces:**
- Produces:
  - `formatDateTimeFull(value: string | Date | null | undefined): string` returns `dd/mm/yyyy HH:mm:ss` in Saigon time. It returns `""` for empty or invalid input. A `YYYY-MM-DD` day-only string reads as Saigon midnight.
  - `parseVnDay(text: string): string | null` turns `dd/mm/yyyy` (day and month may be 1 or 2 digits, year 4 digits) into `YYYY-MM-DD`. It returns null for impossible dates or any other shape.
  - `formatVnDay(isoDay: string): string` turns `YYYY-MM-DD` into `dd/mm/yyyy` and returns `""` for any other shape.

- [ ] **Step 1: Write the failing tests.** In `lib/shared/datetime.test.ts`, extend the existing import on line 2 to `import { formatDateTime, formatDate, formatTime, toSaigonIsoString, formatDateTimeFull, parseVnDay, formatVnDay } from "./datetime";`, then append:

```ts
describe("formatDateTimeFull (BR-DATA-006)", () => {
  it("shows a stored instant in Saigon time to the second", () => {
    expect(formatDateTimeFull("2026-09-28T09:13:06.000Z")).toBe("28/09/2026 16:13:06");
  });
  it("shows a Saigon-midnight slip on its own day, not the day before (PO-188)", () => {
    expect(formatDateTimeFull("2026-09-22T17:00:00+00:00")).toBe("23/09/2026 00:00:00");
  });
  it("reads a day-only value as Saigon midnight, never 07:00:00", () => {
    expect(formatDateTimeFull("2026-09-28")).toBe("28/09/2026 00:00:00");
  });
  it("returns empty for empty or unreadable input", () => {
    expect(formatDateTimeFull("")).toBe("");
    expect(formatDateTimeFull(null)).toBe("");
    expect(formatDateTimeFull("không phải ngày")).toBe("");
  });
});

describe("parseVnDay / formatVnDay", () => {
  it("parses dd/mm/yyyy, with or without leading zeros", () => {
    expect(parseVnDay("23/09/2026")).toBe("2026-09-23");
    expect(parseVnDay(" 1/9/2026 ")).toBe("2026-09-01");
  });
  it("rejects impossible dates and other shapes", () => {
    expect(parseVnDay("31/02/2026")).toBeNull();
    expect(parseVnDay("2026-09-23")).toBeNull();
    expect(parseVnDay("abc")).toBeNull();
    expect(parseVnDay("")).toBeNull();
  });
  it("formats an ISO day for display", () => {
    expect(formatVnDay("2026-09-01")).toBe("01/09/2026");
    expect(formatVnDay("bad")).toBe("");
  });
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `npx vitest run lib/shared/datetime.test.ts`
Expected: FAIL. The three functions are not exported (missing function, not a wrong value).

- [ ] **Step 3: Implement** — append to `lib/shared/datetime.ts`:

```ts
const DAY_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * BR-DATA-006: every date outside a filter shows dd/mm/yyyy HH:mm:ss.
 * A day-only value ("2026-09-28") has no time; it is read as Saigon
 * midnight so it shows 00:00:00 -- `new Date("2026-09-28")` would be UTC
 * midnight, i.e. 07:00:00 in Saigon.
 */
export function formatDateTimeFull(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = DAY_ONLY.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]} 00:00:00`;
  }
  return formatDateTime(value, { withSeconds: true });
}

/** Filter input: "dd/mm/yyyy" (1- or 2-digit day and month) -> "YYYY-MM-DD", or null. */
export function parseVnDay(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${m[3]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function formatVnDay(isoDay: string): string {
  const m = DAY_ONLY.exec(isoDay);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
```

- [ ] **Step 4: Run to watch it pass**

Run: `npx vitest run lib/shared/datetime.test.ts`
Expected: PASS, all tests in the file, old ones included.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/datetime.ts lib/shared/datetime.test.ts
git commit -m "feat(dates): full dd/mm/yyyy HH:mm:ss display and dd/mm/yyyy day input (BR-DATA-006)"
```

### Task 2: Purchase-order list page function, and the menu as data

Two deliverables. Both are pure data or pure logic with their own tests, and both are consumed by Part B.

**Files:**
- Create: `lib/purchasing/purchase-order-list.ts`
- Test: `lib/purchasing/purchase-order-list.test.ts`
- Create: `app/admin/nav-items.ts`
- Test: `app/admin/nav-items.test.ts`
- Modify: `app/admin/nav-guard.test.ts` (read `nav-items.ts` instead of `layout.tsx`)
- Modify: `app/admin/nav-allowlist.ts` (add two entries)

**Interfaces:**
- Consumes: `formatDateTimeFull` (Task 1); `toSaigonUtcRange` from `lib/shared/report-time.ts`.
- Produces, in `lib/purchasing/purchase-order-list.ts`:

```ts
export const PURCHASE_ORDERS_PER_PAGE = 20;
export interface PurchaseOrderListFilters {
  q?: string; status?: string; supplier?: string; from?: string; to?: string; page?: string;
}
export interface PurchaseOrderListRow {
  id: string; dateText: string; supplierName: string; sourceName: string;
  status: string; totalAmount: number;
}
export interface PurchaseOrderListPage {
  rows: PurchaseOrderListRow[]; total: number; page: number; pageCount: number;
  firstIndex: number; lastIndex: number; rangeError: boolean;
}
export function listPurchaseOrdersPage(input: {
  orders: DBPurchaseOrder[]; suppliers: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  lines: { purchase_order_id: string; item_id: string }[];
  items: { id: string; name: string }[];
  filters: PurchaseOrderListFilters;
}): PurchaseOrderListPage;
```

`from` and `to` are `YYYY-MM-DD`. `firstIndex` and `lastIndex` are 1-based for the footer "1–20 trên 191 phiếu"; both are 0 when `total` is 0.

- Produces, in `app/admin/nav-items.ts`:

```ts
import type { LucideIcon } from "lucide-react";
export interface NavLink { name: string; href: string }
export interface NavGroup { name: string; icon: LucideIcon; href?: string; children?: NavLink[] }
export const NAV_GROUPS: NavGroup[];
export const PHONE_BAR_HREFS: readonly string[]; // the three plain links on the phone bar, in order
```

- [ ] **Step 1: Write the failing list tests** — `lib/purchasing/purchase-order-list.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listPurchaseOrdersPage } from "./purchase-order-list";
import type { DBPurchaseOrder } from "@/types/db";

function po(id: string, transaction_date: string, extra: Partial<DBPurchaseOrder> = {}): DBPurchaseOrder {
  return {
    id, transaction_date, created_at: transaction_date, supplier_id: "SUP-1", source_id: "SRC-1",
    subtotal: "0", shipping_cost: "0", tax_amount: "0", discount_amount: "0",
    total_amount: "100000", status: "COMPLETED", ...extra,
  };
}
const base = {
  suppliers: [{ id: "SUP-1", name: "Không rõ" }, { id: "SUP-2", name: "Vinamilk" }],
  sources: [{ id: "SRC-1", name: "Mua ngoài" }],
  lines: [{ purchase_order_id: "PO-190", item_id: "IT-1" }],
  items: [{ id: "IT-1", name: "Sữa tươi" }],
};
const real = [
  po("PO-188", "2026-09-22T17:00:00+00:00", { total_amount: "300000" }),
  po("PO-191", "2026-09-28T09:13:06+00:00", { total_amount: "165000" }),
  po("PO-190", "2026-09-24T07:03:37+00:00", { supplier_id: "SUP-2", total_amount: "54864", supplier_invoice_code: "HD-77" }),
];

describe("listPurchaseOrdersPage", () => {
  it("sorts by slip date newest first and formats the date to the second", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: {} });
    expect(r.rows.map(x => x.id)).toEqual(["PO-191", "PO-190", "PO-188"]);
    expect(r.rows[0]).toEqual({
      id: "PO-191", dateText: "28/09/2026 16:13:06", supplierName: "Không rõ",
      sourceName: "Mua ngoài", status: "COMPLETED", totalAmount: 165000,
    });
    expect(r.rows[2].dateText).toBe("23/09/2026 00:00:00");
  });

  it("breaks a tie on slip date by created_at, then id, newest first", () => {
    const orders = [
      po("PO-001", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-05T01:00:00+00:00" }),
      po("PO-002", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-06T01:00:00+00:00" }),
      po("PO-003", "2026-09-01T17:00:00+00:00", { created_at: "2026-09-06T01:00:00+00:00" }),
    ];
    expect(listPurchaseOrdersPage({ ...base, orders, filters: {} }).rows.map(x => x.id))
      .toEqual(["PO-003", "PO-002", "PO-001"]);
  });

  it("keeps a Saigon-midnight slip on the first day of the range (PO-188)", () => {
    const from23 = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-23", to: "2026-09-23" } });
    expect(from23.rows.map(x => x.id)).toEqual(["PO-188"]);
    const upTo22 = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-01", to: "2026-09-22" } });
    expect(upTo22.rows).toEqual([]);
  });

  it("filters with only one end of the range set", () => {
    expect(listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-24" } }).rows.map(x => x.id))
      .toEqual(["PO-191", "PO-190"]);
    expect(listPurchaseOrdersPage({ ...base, orders: real, filters: { to: "2026-09-23" } }).rows.map(x => x.id))
      .toEqual(["PO-188"]);
  });

  it("ignores a reversed range and flags it", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: { from: "2026-09-28", to: "2026-09-01" } });
    expect(r.rangeError).toBe(true);
    expect(r.total).toBe(3);
  });

  it("searches code, supplier name, supplier invoice code and item names, case-insensitively", () => {
    const ids = (q: string) => listPurchaseOrdersPage({ ...base, orders: real, filters: { q } }).rows.map(x => x.id);
    expect(ids("po-188")).toEqual(["PO-188"]);
    expect(ids("VINAMILK")).toEqual(["PO-190"]);
    expect(ids("hd-77")).toEqual(["PO-190"]);
    expect(ids("sữa tươi")).toEqual(["PO-190"]);
    expect(ids("   ")).toHaveLength(3);
  });

  it("filters by status and supplier", () => {
    const orders = [...real, po("PO-192", "2026-09-29T01:00:00+00:00", { status: "DRAFT" })];
    expect(listPurchaseOrdersPage({ ...base, orders, filters: { status: "DRAFT" } }).rows.map(x => x.id)).toEqual(["PO-192"]);
    expect(listPurchaseOrdersPage({ ...base, orders, filters: { supplier: "SUP-2" } }).rows.map(x => x.id)).toEqual(["PO-190"]);
  });

  it("shows a dash for a supplier or source that no longer resolves", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: [po("PO-9", "2026-09-01T00:00:00Z", { supplier_id: "GONE", source_id: "" })], filters: {} });
    expect(r.rows[0].supplierName).toBe("—");
    expect(r.rows[0].sourceName).toBe("—");
  });

  it("cuts 20 per page and clamps bad page numbers", () => {
    const orders = Array.from({ length: 45 }, (_, i) =>
      po(`PO-${String(i + 1).padStart(3, "0")}`, new Date(Date.UTC(2026, 8, 1) + i * 3600_000).toISOString()));
    const p = (page?: string) => listPurchaseOrdersPage({ ...base, orders, filters: { page } });
    expect(p().rows).toHaveLength(20);
    expect(p().rows[0].id).toBe("PO-045");
    expect(p("2").rows[0].id).toBe("PO-025");
    expect(p("2")).toMatchObject({ page: 2, pageCount: 3, firstIndex: 21, lastIndex: 40, total: 45 });
    expect(p("3").rows).toHaveLength(5);
    expect(p("abc").page).toBe(1);
    expect(p("0").page).toBe(1);
    expect(p("-2").page).toBe(1);
    expect(p("999")).toMatchObject({ page: 3, firstIndex: 41, lastIndex: 45 });
  });

  it("returns one empty page when nothing matches", () => {
    const r = listPurchaseOrdersPage({ ...base, orders: real, filters: { q: "không có" } });
    expect(r).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0 });
  });
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `npx vitest run lib/purchasing/purchase-order-list.test.ts`
Expected: FAIL on import. The module does not exist yet.

- [ ] **Step 3: Implement** `lib/purchasing/purchase-order-list.ts`:

```ts
import type { DBPurchaseOrder } from "@/types/db";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { toSaigonUtcRange } from "@/lib/shared/report-time";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 3.5: the shared
// slip-list template, first applied to purchase orders. Runs on the server;
// the browser receives one page of rows, never the whole table.
export const PURCHASE_ORDERS_PER_PAGE = 20;
const MAX_QUERY_LENGTH = 100;
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface PurchaseOrderListFilters {
  q?: string; status?: string; supplier?: string; from?: string; to?: string; page?: string;
}
export interface PurchaseOrderListRow {
  id: string; dateText: string; supplierName: string; sourceName: string;
  status: string; totalAmount: number;
}
export interface PurchaseOrderListPage {
  rows: PurchaseOrderListRow[]; total: number; page: number; pageCount: number;
  firstIndex: number; lastIndex: number; rangeError: boolean;
}

function slipTime(po: DBPurchaseOrder): number {
  const t = new Date(po.transaction_date || po.created_at || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}
function createdTime(po: DBPurchaseOrder): number {
  const t = new Date(po.created_at || "").getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function listPurchaseOrdersPage(input: {
  orders: DBPurchaseOrder[];
  suppliers: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  lines: { purchase_order_id: string; item_id: string }[];
  items: { id: string; name: string }[];
  filters: PurchaseOrderListFilters;
}): PurchaseOrderListPage {
  const { orders, filters } = input;
  const supplierName = new Map(input.suppliers.map(s => [s.id, s.name]));
  const sourceName = new Map(input.sources.map(s => [s.id, s.name]));
  const itemName = new Map(input.items.map(i => [i.id, i.name]));
  const itemText = new Map<string, string>();
  for (const line of input.lines) {
    const name = itemName.get(line.item_id);
    if (!name) continue;
    itemText.set(line.purchase_order_id, `${itemText.get(line.purchase_order_id) ?? ""} ${name}`);
  }

  const term = (filters.q ?? "").trim().slice(0, MAX_QUERY_LENGTH).toLowerCase();
  const from = filters.from && DAY_ONLY.test(filters.from) ? filters.from : undefined;
  const to = filters.to && DAY_ONLY.test(filters.to) ? filters.to : undefined;
  const rangeError = Boolean(from && to && from > to);
  const range = rangeError ? null : toSaigonUtcRange(from ?? "1970-01-01", to ?? "9999-12-31");
  const startMs = from && range ? range.startUtc.getTime() : -Infinity;
  const endMs = to && range ? range.endUtc.getTime() : Infinity;

  const matched = orders.filter(po => {
    if (filters.status && filters.status !== "ALL" && po.status !== filters.status) return false;
    if (filters.supplier && filters.supplier !== "ALL" && po.supplier_id !== filters.supplier) return false;
    const t = slipTime(po);
    if (t < startMs || t > endMs) return false;
    if (!term) return true;
    const haystack = [po.id, supplierName.get(po.supplier_id) ?? "", po.supplier_invoice_code ?? "", itemText.get(po.id) ?? ""]
      .join(" ").toLowerCase();
    return haystack.includes(term);
  });

  matched.sort((a, b) =>
    slipTime(b) - slipTime(a) || createdTime(b) - createdTime(a) || b.id.localeCompare(a.id));

  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / PURCHASE_ORDERS_PER_PAGE));
  const asked = Number(filters.page);
  const page = Number.isInteger(asked) && asked >= 1 ? Math.min(asked, pageCount) : 1;
  const start = (page - 1) * PURCHASE_ORDERS_PER_PAGE;
  const slice = matched.slice(start, start + PURCHASE_ORDERS_PER_PAGE);

  return {
    rows: slice.map(po => ({
      id: po.id,
      dateText: formatDateTimeFull(po.transaction_date || po.created_at),
      supplierName: supplierName.get(po.supplier_id) ?? "—",
      sourceName: sourceName.get(po.source_id) ?? "—",
      status: po.status,
      totalAmount: Number(po.total_amount) || 0,
    })),
    total,
    page,
    pageCount,
    firstIndex: total === 0 ? 0 : start + 1,
    lastIndex: start + slice.length,
    rangeError,
  };
}
```

- [ ] **Step 4: Run to watch it pass**

Run: `npx vitest run lib/purchasing/purchase-order-list.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Write the failing menu tests** — `app/admin/nav-items.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PHONE_BAR_HREFS } from "./nav-items";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 2 (owner, 2026-09-28).
const EXPECTED: [string, [string, string][]][] = [
  ["Tổng quan", []],
  ["Bán hàng", [
    ["Đơn hàng", "/admin/orders"], ["Món", "/admin/products"], ["Nhóm món", "/admin/products/categories"],
    ["Topping & tuỳ chọn", "/admin/products/modifiers"], ["Khuyến mãi", "/admin/promotions"],
    ["Thương hiệu", "/admin/brands"], ["Điểm bán", "/admin/outlets"],
  ]],
  ["Nhập hàng", [["Phiếu nhập", "/admin/inventory/purchase-orders"], ["Nhà cung cấp", "/admin/suppliers"]]],
  ["Kho", [
    ["Phiếu xuất", "/admin/inventory/issue-slips"], ["Kiểm kê", "/admin/inventory/stocktake"],
    ["Hàng hoá", "/admin/inventory/items"], ["Tài sản", "/admin/inventory/assets"],
    ["Thời hạn khấu hao", "/admin/inventory/asset-bands"], ["Đơn vị tính", "/admin/inventory/units"],
    ["Phân loại hàng", "/admin/inventory/categories"],
  ]],
  ["Thu chi", [["Sổ thu chi", "/admin/finance"], ["Nhóm thu chi", "/admin/finance/categories"], ["Tài khoản ngân hàng", "/admin/finance/bank-accounts"]]],
  ["Báo cáo", [
    ["Tổng kết ngày", "/admin/reports/daily"], ["Doanh số", "/admin/reports/sales"],
    ["Hàng đã xuất", "/admin/reports/issued"], ["Lãi lỗ", "/admin/reports/pnl"],
  ]],
  ["Cài đặt", [["Nhân viên & quyền", "/admin/users"], ["Nhật ký hoạt động", "/admin/activity-log"]]],
];

describe("admin menu (7 groups)", () => {
  it("has exactly the settled groups, items, names and order", () => {
    const actual = NAV_GROUPS.map(g => [g.name, (g.children ?? []).map(c => [c.name, c.href])]);
    expect(actual).toEqual(EXPECTED);
  });
  it("Tổng quan is a direct link to /admin", () => {
    expect(NAV_GROUPS[0].href).toBe("/admin");
  });
  it("the phone bar links Tổng quan, Phiếu nhập, Phiếu xuất in that order", () => {
    expect(PHONE_BAR_HREFS).toEqual(["/admin", "/admin/inventory/purchase-orders", "/admin/inventory/issue-slips"]);
  });
});
```

- [ ] **Step 6: Run to watch it fail**

Run: `npx vitest run app/admin/nav-items.test.ts`
Expected: FAIL on import. `./nav-items` does not exist yet.

- [ ] **Step 7: Implement** `app/admin/nav-items.ts`:

```ts
import {
  LayoutDashboard, ShoppingBag, Truck, Package, Wallet, TrendingUp, Settings, type LucideIcon,
} from "lucide-react";

// The admin menu, owner decision 2026-09-28 (spec
// docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md section 2).
// Read by the desktop sidebar, the phone bar and "Thêm" sheet in
// app/admin/layout.tsx, and by app/admin/nav-guard.test.ts -- keep every
// href a plain double-quoted "/admin..." literal, the guard reads this file
// as text.
export interface NavLink { name: string; href: string }
export interface NavGroup { name: string; icon: LucideIcon; href?: string; children?: NavLink[] }

export const NAV_GROUPS: NavGroup[] = [
  { name: "Tổng quan", icon: LayoutDashboard, href: "/admin" },
  {
    name: "Bán hàng", icon: ShoppingBag, children: [
      { name: "Đơn hàng", href: "/admin/orders" },
      { name: "Món", href: "/admin/products" },
      { name: "Nhóm món", href: "/admin/products/categories" },
      { name: "Topping & tuỳ chọn", href: "/admin/products/modifiers" },
      { name: "Khuyến mãi", href: "/admin/promotions" },
      { name: "Thương hiệu", href: "/admin/brands" },
      { name: "Điểm bán", href: "/admin/outlets" },
    ],
  },
  {
    name: "Nhập hàng", icon: Truck, children: [
      { name: "Phiếu nhập", href: "/admin/inventory/purchase-orders" },
      { name: "Nhà cung cấp", href: "/admin/suppliers" },
    ],
  },
  {
    name: "Kho", icon: Package, children: [
      { name: "Phiếu xuất", href: "/admin/inventory/issue-slips" },
      { name: "Kiểm kê", href: "/admin/inventory/stocktake" },
      { name: "Hàng hoá", href: "/admin/inventory/items" },
      { name: "Tài sản", href: "/admin/inventory/assets" },
      { name: "Thời hạn khấu hao", href: "/admin/inventory/asset-bands" },
      { name: "Đơn vị tính", href: "/admin/inventory/units" },
      { name: "Phân loại hàng", href: "/admin/inventory/categories" },
    ],
  },
  {
    name: "Thu chi", icon: Wallet, children: [
      { name: "Sổ thu chi", href: "/admin/finance" },
      { name: "Nhóm thu chi", href: "/admin/finance/categories" },
      { name: "Tài khoản ngân hàng", href: "/admin/finance/bank-accounts" },
    ],
  },
  {
    name: "Báo cáo", icon: TrendingUp, children: [
      { name: "Tổng kết ngày", href: "/admin/reports/daily" },
      { name: "Doanh số", href: "/admin/reports/sales" },
      { name: "Hàng đã xuất", href: "/admin/reports/issued" },
      { name: "Lãi lỗ", href: "/admin/reports/pnl" },
    ],
  },
  {
    name: "Cài đặt", icon: Settings, children: [
      { name: "Nhân viên & quyền", href: "/admin/users" },
      { name: "Nhật ký hoạt động", href: "/admin/activity-log" },
    ],
  },
];

export const PHONE_BAR_HREFS: readonly string[] = [
  "/admin",
  "/admin/inventory/purchase-orders",
  "/admin/inventory/issue-slips",
];
```

- [ ] **Step 8: Repoint the guard and extend the allowlist**

In `app/admin/nav-guard.test.ts`, change the line that reads the layout source. The regex in `extractNavHrefs` works unchanged on this file.

```ts
    const layoutSource = readFileSync(join(repoRoot, "app", "admin", "nav-items.ts"), "utf8");
```

Rename the variable to `navSource` at both of its uses. In the header comment, change "the real layout.tsx" to "the real nav-items.ts".

In `app/admin/nav-allowlist.ts`, append:

```ts
  {
    route: "/admin/clear-cache",
    reason:
      "left the menu 2026-09-29 (spec 2026-09-29-menu-va-khuon-trang-design.md section 2): saves already refresh cached data; kept as a fallback by URL",
  },
  {
    route: "/admin/inventory/conversions",
    reason:
      "left the menu 2026-09-29 (same spec, section 2): opened from the \"Bảng quy đổi\" button on the Hàng hoá page",
  },
```

Also update `extractNavHrefs`'s comment in `lib/shared/nav-completeness.ts`, which now reads `nav-items.ts`. Change only the comment; the code stays.

- [ ] **Step 9: Run the menu tests and the guard**

Run: `npx vitest run app/admin/nav-items.test.ts app/admin/nav-guard.test.ts lib/shared/nav-completeness.test.ts`
Expected: PASS. The guard now passes against `nav-items.ts` even though `layout.tsx` still has its old `navItems`; Task 6 removes those.

- [ ] **Step 10: Commit**

Commit the menu only. `lib/purchasing/purchase-order-list.ts` stays uncommitted until Task 3 imports it: the pre-commit `orphan-modules` gate rejects a `lib/` module that only its own test imports.

```bash
git add app/admin/nav-items.ts app/admin/nav-items.test.ts app/admin/nav-guard.test.ts app/admin/nav-allowlist.ts lib/shared/nav-completeness.ts
git commit -m "feat(overhaul): 7-group menu as data; nav guard reads it"
```

### Task 3: Server action for one page of purchase orders, checked against real data

**Files:**
- Modify: `app/admin/inventory/purchase-orders/actions.ts`
- Temporary, deleted in the same task: `scripts/.tmp-po-list-check.ts`

**Interfaces:**
- Consumes: `listPurchaseOrdersPage`, `PurchaseOrderListFilters`, `PurchaseOrderListPage` (Task 2).
- Produces:

```ts
export async function getPurchaseOrdersPage(filters: PurchaseOrderListFilters): Promise<
  PurchaseOrderListPage & { suppliers: { id: string; name: string }[] }
>;
```

`suppliers` feeds the "Nhà cung cấp" filter. It is every supplier, sorted by name with `localeCompare(…, "vi")`.

- [ ] **Step 1: Add the action** below `getPurchaseOrdersData` in `actions.ts`. Leave `getPurchaseOrdersData` in place; Task 8 removes its last caller and reports it.

```ts
export async function getPurchaseOrdersPage(filters: PurchaseOrderListFilters): Promise<
  PurchaseOrderListPage & { suppliers: { id: string; name: string }[] }
> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [orders, suppliers, sources, lines, items] = await Promise.all([
    findAll("Purchase_Orders") as Promise<DBPurchaseOrder[]>,
    findAll("Suppliers") as Promise<DBSupplier[]>,
    findAll("Purchase_Sources") as Promise<DBPurchaseSource[]>,
    findAll("Purchase_Order_Lines") as Promise<RawPurchaseOrderLine[]>,
    findAll("Purchased_Items") as Promise<DBPurchasedItem[]>,
  ]);
  const page = listPurchaseOrdersPage({ orders, suppliers, sources, lines, items, filters });
  const supplierOptions = suppliers
    .map(s => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { ...page, suppliers: supplierOptions };
}
```

Add the import:

```ts
import { listPurchaseOrdersPage, type PurchaseOrderListFilters, type PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";
```

If `RawPurchaseOrderLine` lacks `purchase_order_id` or `item_id` in its type, tsc says so. Stop and report; do not widen the type by guessing.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Check against the real database (read-only)**

Write `scripts/.tmp-po-list-check.ts`:
- Load `.env.local`.
- Read the five tables with supabase-js (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`), all rows, with `select("*")`.
- Call `listPurchaseOrdersPage` with `{}` and with `{ from: "2026-09-23", to: "2026-09-23" }`.
- Print `total`, the first 5 rows, row 20's `id` and `dateText`, and the ids from the second call.

Run: `npx vite-node scripts/.tmp-po-list-check.ts`

Expected, on the 2026-09-29 measurement:
- `total` = 191, or more if the owner has entered slips since.
- Rows 1–5 as in the "Ví dụ tính sẵn" table above.
- Row 20 = PO-163 `04/09/2026 00:00:00`.
- The second call includes PO-188.

If the total grew, report the new count and the new first rows; that is not a failure.

Delete the script: `rm scripts/.tmp-po-list-check.ts`.

- [ ] **Step 4: Full gates and commit**

Run:
- `npx vitest run`
- `npm run build`

Expected: both green.

```bash
git add lib/purchasing/purchase-order-list.ts lib/purchasing/purchase-order-list.test.ts app/admin/inventory/purchase-orders/actions.ts
git commit -m "feat(purchasing): one page of purchase orders, filtered and sorted on the server"
```

Report to Opus:
- The real-data output from Step 3.
- Total tests before and after.
- The two dead-code notes: `getPurchaseOrdersData` is still called, and `.bento-card`.

---

# Part B — Gemini 3.1 Pro (`agy --model gemini-3.1-pro-high -p`)

Each task below is one `agy` handoff. Opus pastes the task text, the Global Constraints, and the spec path into the prompt.

Gemini works under the same rules:
- Run the named test red first, then green.
- Run `npx tsc --noEmit` and `npx vitest run` before reporting.
- Do not push.

Opus checks every task by opening the page with playwright at 1280×800 and at 375×812.

### Task 4: Colour and font guard tests (red), then palette and font

**Files:**
- Modify: `app/globals.test.ts` (replace the `it.todo` with real tests)
- Create: `app/colour-guard.test.ts`
- Modify: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`
- Modify: `app/admin/reports/components/CategoryPieChart.tsx`, `app/admin/reports/pnl/components/PnlChart.tsx`, `app/pos/components/ProductGrid.tsx`

**Interfaces:** Produces the Tailwind names every later task uses: `bg-page`, `bg-surface-card`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`, `bg-primary`, `bg-primary-soft`, `text-danger`. The old names success, warning and processing keep working, repointed.

- [ ] **Step 1: Replace `app/globals.test.ts` with:**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision 2026-09-29 (spec 2026-09-29-menu-va-khuon-trang-design.md
// section 3.2): Be Vietnam Pro for every text, POS included; Outfit (no
// Vietnamese glyphs) and Plus Jakarta Sans are gone.
const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("app font", () => {
  it("loads Be Vietnam Pro with the Vietnamese subset from the root layout", () => {
    const layout = read("app", "layout.tsx");
    expect(layout).toMatch(/Be_Vietnam_Pro\(/);
    expect(layout).toMatch(/subsets:\s*\[[^\]]*"vietnamese"/);
  });
  it("no longer references Outfit or Plus Jakarta Sans", () => {
    for (const file of [read("app", "globals.css"), read("tailwind.config.ts")]) {
      expect(file).not.toMatch(/Outfit|Plus Jakarta/);
    }
  });
});
```

- [ ] **Step 2: Create `app/colour-guard.test.ts`:**

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 3.1: four colours,
// fixed in code (owner Q8b). Screens use the CSS-variable names only.
const ALLOWED_HEX = new Set(["#F7F5F0", "#FFFFFF", "#1F1B16", "#5E574E", "#E4DFD5", "#8A5A1F", "#F2E8D8", "#B3261E"]);
// Hover and pressed shades of the primary: allowed in globals.css only.
const HOVER_SHADES = new Set(["#744B19", "#5E3D14"]);
// The developer feedback overlay is a dev-only tool, not an owner screen.
const SKIP = [`components${sep}dev-feedback${sep}`];
const RAW_TAILWIND = /\b(?:bg|text|border|ring|shadow|from|to|fill|stroke)-(?:red|green|blue|indigo|emerald|amber|yellow|orange|purple|pink|sky|teal|cyan|lime|rose|violet|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith(".tsx") && !full.endsWith(".test.tsx") ? [full] : [];
  });
}

describe("colour guard", () => {
  it("screens use only the palette", () => {
    const root = process.cwd();
    const offenders: string[] = [];
    for (const file of [...tsxFiles(join(root, "app")), ...tsxFiles(join(root, "components"))]) {
      const rel = relative(root, file);
      if (SKIP.some(s => rel.includes(s))) continue;
      const src = readFileSync(file, "utf8");
      for (const hex of src.match(/#[0-9A-Fa-f]{6}\b/g) ?? []) {
        if (!ALLOWED_HEX.has(hex.toUpperCase())) offenders.push(`${rel}: ${hex}`);
      }
      for (const cls of src.match(RAW_TAILWIND) ?? []) offenders.push(`${rel}: ${cls}`);
    }
    expect(offenders).toEqual([]);
  });

  it("globals.css defines only palette values", () => {
    const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
    const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    const bad = (rootBlock.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).filter(h => !ALLOWED_HEX.has(h.toUpperCase()) && !HOVER_SHADES.has(h.toUpperCase()));
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 3: Run both to watch them fail**

Run: `npx vitest run app/globals.test.ts app/colour-guard.test.ts`

Expected FAILs, by wrong value (not missing code):
- Font: `Be_Vietnam_Pro(` is absent, and Outfit is present.
- Colour guard, first test: 10 hex values in `CategoryPieChart.tsx` and 3 `shadow-indigo-100` in `ProductGrid.tsx`.
- Colour guard, second test: the old `:root` values.

- [ ] **Step 4: Palette.** In `app/globals.css`, set `:root` to exactly these values and delete `--color-accent-cyan` and `--color-chart-profit`:

```css
:root {
  --background: #F7F5F0;
  --foreground: #1F1B16;
  /* Owner decision 2026-09-29 (Q8, Q8b): palette "Cà phê", fixed in code.
     Four roles -- background, text, primary, red; old status names are
     repointed so existing classes keep working. */
  --color-primary: #8A5A1F;
  --color-primary-hover: #744B19;
  --color-primary-active: #5E3D14;
  --color-primary-soft: #F2E8D8;
  --color-bg-page: #F7F5F0;
  --color-surface-card: #FFFFFF;
  --color-surface-secondary: #E4DFD5;
  --color-sidebar: #FFFFFF;
  --color-text-primary: #1F1B16;
  --color-text-secondary: #5E574E;
  --color-text-muted: #5E574E;
  --color-border: #E4DFD5;
  --color-success: #8A5A1F;
  --color-warning: #B3261E;
  --color-danger: #B3261E;
  --color-processing: #8A5A1F;
  --color-focus-ring: #8A5A1F;
}
```

In `tailwind.config.ts`, remove the `accent` and `"chart-profit"` colour entries.

In `app/admin/reports/pnl/components/PnlChart.tsx`, replace `bg-chart-profit` with `bg-primary` and `fill-chart-profit` with `fill-primary`.

`--color-sidebar` becomes white: the sidebar becomes light, as in the mockup. Task 6 restyles its text. Until Task 6 lands, the old sidebar shows light text on white. Do not ship Task 4 alone; Opus merges Tasks 4–6 before asking the owner to look.

- [ ] **Step 5: Font.** In `app/layout.tsx`:

```tsx
import { Be_Vietnam_Pro } from "next/font/google";

const appFont = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-app",
});
```

Put `className={appFont.variable}` on `<html>`.

In `app/globals.css`:
- Delete the Google Fonts `@import` line.
- Delete the `h1, h2, h3` rule and its comment.
- Set `body { font-family: var(--font-app), Arial, Helvetica, sans-serif; font-variant-numeric: tabular-nums; }`.

In `tailwind.config.ts`, set `fontFamily: { sans: ["var(--font-app)", "Arial", "sans-serif"], display: ["var(--font-app)", "Arial", "sans-serif"] }`. The `display` name stays, because pages already use `font-display`.

- [ ] **Step 6: Pie chart and POS tabs**
  - In `CategoryPieChart.tsx`, replace the 10-colour array with shades of the primary, darkest first: `["#8A5A1F", "#A57A45", "#BF9A6B", "#D6BC96", "#E9DBC4", "#5E3D14", "#744B19", "#C9A77C", "#DCC7A6", "#F2E8D8"]`. Leave the legend as it is; it already lists the name and percentage.
  - Add those 10 values to `ALLOWED_HEX` in `app/colour-guard.test.ts`, under a comment `// pie-chart shades of the primary, CategoryPieChart.tsx`.
  - In `ProductGrid.tsx`, drop `shadow-indigo-100` from the three class strings and keep `shadow-md`.

- [ ] **Step 7: Run the guards, then all tests**

Run:
- `npx vitest run app/globals.test.ts app/colour-guard.test.ts` → Expected: PASS.
- `npx vitest run` → Expected: PASS, with one fewer todo than before.
- `npx vite-node scripts/doc-checks/open-items.ts` → Expected: prints `1 todo(s)`, and `docs/04-operations/OPEN-ITEMS.md` no longer lists the font item.

- [ ] **Step 8: Commit**

```bash
git add app/globals.test.ts app/colour-guard.test.ts app/globals.css tailwind.config.ts app/layout.tsx app/admin/reports/components/CategoryPieChart.tsx app/admin/reports/pnl/components/PnlChart.tsx app/pos/components/ProductGrid.tsx docs/04-operations/OPEN-ITEMS.md
git commit -m "feat(ui): palette Cà phê and Be Vietnam Pro everywhere (owner 2026-09-29)"
```

### Task 5: The POS under the new palette and font

**Files:** none expected. This task is a check with fixes only if the check fails.

- [ ] **Step 1:** Run `npm run build` and `npm run start`. Log in and open `/pos?outletId=<first outlet>` at 1280×800 and at 375×812.
- [ ] **Step 2:** Confirm by eye:
  - The "Bán chạy" tab is first and selected.
  - Long product names are still cut at two lines. The warning in the old `app/globals.test.ts` comment: product names use `<h3 line-clamp-2>`.
  - The cart total is not cut off.
- [ ] **Step 3:** In devtools:
  - Set the network to Offline and reload `/pos`. The page loads from the service worker, with the new font and colours.
  - Back online, place no order; this check does not write data.
- [ ] **Step 4:** Report with two screenshots per size. If a name overflows, fix only its class in `app/pos/components/ProductCard.tsx`, run `npx vitest run app/pos`, and commit as `fix(pos): keep long names inside the card after the font change`.

### Task 6: Desktop sidebar (collapsible) and phone bar with "Thêm" sheet

**Files:**
- Modify: `app/admin/layout.tsx`
- Create: `app/admin/components/AdminSidebar.tsx`, `app/admin/components/PhoneNavBar.tsx`, `app/admin/components/MoreSheet.tsx`
- Create: `app/admin/components/sidebar-state.ts`
- Test: `app/admin/components/sidebar-state.test.ts`

**Interfaces:**
- Consumes: `NAV_GROUPS`, `PHONE_BAR_HREFS`, `NavGroup`, `NavLink` from `./nav-items` (Task 2), and the existing `PosOutletPicker`.
- Produces:
  - `readSidebarCollapsed(storage: Pick<Storage, "getItem"> | null): boolean`
  - `writeSidebarCollapsed(storage: Pick<Storage, "setItem"> | null, collapsed: boolean): void`
  - `activeGroupName(pathname: string): string | null`, the group whose child href is the longest prefix of `pathname`.
  - All three live in `sidebar-state.ts`.

- [ ] **Step 1: Write the failing tests** — `app/admin/components/sidebar-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { activeGroupName, readSidebarCollapsed, writeSidebarCollapsed } from "./sidebar-state";

describe("sidebar state", () => {
  it("reads collapsed only from the exact stored value", () => {
    expect(readSidebarCollapsed({ getItem: () => "1" })).toBe(true);
    expect(readSidebarCollapsed({ getItem: () => "0" })).toBe(false);
    expect(readSidebarCollapsed({ getItem: () => "garbage" })).toBe(false);
    expect(readSidebarCollapsed(null)).toBe(false);
  });
  it("never throws when storage is blocked", () => {
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); } };
    expect(readSidebarCollapsed(blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(blocked, true)).not.toThrow();
  });
  it("finds the group of the current page by the longest matching link", () => {
    expect(activeGroupName("/admin/inventory/purchase-orders/PO-191")).toBe("Nhập hàng");
    expect(activeGroupName("/admin/products/categories")).toBe("Bán hàng");
    expect(activeGroupName("/admin/inventory/conversions")).toBe(null);
    expect(activeGroupName("/admin")).toBe("Tổng quan");
  });
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `npx vitest run app/admin/components/sidebar-state.test.ts`
Expected: FAIL on import.

- [ ] **Step 3: Implement `sidebar-state.ts`:**

```ts
import { NAV_GROUPS } from "../nav-items";

const KEY = "fnb.sidebarCollapsed";

export function readSidebarCollapsed(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(storage: Pick<Storage, "setItem"> | null, collapsed: boolean): void {
  try {
    storage?.setItem(KEY, collapsed ? "1" : "0");
  } catch {
    // Private window or blocked site data: the choice just is not remembered.
  }
}

export function activeGroupName(pathname: string): string | null {
  let best: { name: string; length: number } | null = null;
  for (const group of NAV_GROUPS) {
    const hrefs = group.href ? [group.href] : (group.children ?? []).map(c => c.href);
    for (const href of hrefs) {
      const hit = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
      if (hit && (!best || href.length > best.length)) best = { name: group.name, length: href.length };
    }
  }
  return best?.name ?? null;
}
```

- [ ] **Step 4: Run to watch it pass**

Run: `npx vitest run app/admin/components/sidebar-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the three components and rewire `layout.tsx`.** Behaviour, all from spec §3.3–3.4. Use the mockup artifact `Main.dc.html` and `Phone.dc.html` as the look.

  `AdminSidebar.tsx` (shown from `md:`):
  - Width 272px expanded, 76px collapsed; animate the width. Background `bg-surface-card`, right border `border-border`.
  - Top: logo, then the collapse button (`aria-label` "Thu gọn menu" / "Mở rộng menu").
  - Then "Mở máy bán hàng": background `bg-text-primary`, white text, icon only when collapsed. It opens `PosOutletPicker`, exactly as today.
  - Then "Tổng quan", then the 6 groups.
  - Expanded:
    - A group shows its children when opened, one open at a time. The group of the current page (`activeGroupName`) starts open.
    - The active child gets `bg-primary-soft text-primary font-semibold`.
  - Collapsed:
    - Group icons only, with `title` = group name.
    - The active group's icon gets `bg-primary-soft`.
    - Clicking a group icon expands the sidebar, saves "expanded", and opens that group.
  - Bottom: user name and "Đăng xuất" (move the existing sign-out code).
  - State: `useState(false)`, then in `useEffect` read `readSidebarCollapsed(window.localStorage)`. The server render is always expanded; this avoids a hydration mismatch.

  `PhoneNavBar.tsx` (shown below `md:`):
  - Fixed to the bottom, `padding-bottom: env(safe-area-inset-bottom)`.
  - Five slots in this order:
    1. Tổng quan
    2. Phiếu nhập
    3. Phiếu xuất
    4. Thêm
    5. Máy bán hàng
  - Slots 1–3 come from `PHONE_BAR_HREFS`, with names from `NAV_GROUPS`.
  - The active slot is `text-primary`.
  - The POS slot is a 48px `bg-text-primary` circle raised 22px with a shadow, and opens `PosOutletPicker`.
  - Every slot is at least 44px tall and has a visible label.

  `MoreSheet.tsx`:
  - Slides up from the bottom and lists all 6 groups with every child, then the user name and "Đăng xuất".
  - It closes on the × button, on a tap outside, on Escape, and when the route changes.
  - `role="dialog"`, `aria-modal="true"`, focus moves to the sheet when it opens.

  `layout.tsx`:
  - Delete the local `navItems` array, the ☰ button and `isSidebarOpen`.
  - Render `AdminSidebar` and `PhoneNavBar`.
  - Give the page content `pb-24 md:pb-0` so the bar never covers the last row.
  - The top bar on phones shows only the page area; each page keeps its own title.

- [ ] **Step 6: Gates**

Run:
- `npx vitest run app/admin` → Expected: PASS. `nav-guard` still passes because it reads `nav-items.ts`.
- `npx tsc --noEmit` → Expected: clean.
- Then `grep -n "navItems" app/admin/layout.tsx` → Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add app/admin/layout.tsx app/admin/components/AdminSidebar.tsx app/admin/components/PhoneNavBar.tsx app/admin/components/MoreSheet.tsx app/admin/components/sidebar-state.ts app/admin/components/sidebar-state.test.ts
git commit -m "feat(ui): 7-group sidebar that collapses, phone bar with Thêm sheet"
```

### Task 7: Page headings match menu names; "Bảng quy đổi" from Hàng hoá

**Files:**
- Test: `app/admin/page-headings.test.ts`
- Modify: the page or client component of each menu item whose heading differs.

  Known from the `<h1>` / `PageHeader` scan:
  - `app/admin/page.tsx` ("Tổng quan Hệ thống")
  - `app/admin/inventory/asset-bands/page.tsx`
  - `app/admin/inventory/assets/page.tsx`
  - `app/admin/reports/issued/page.tsx`
  - `app/admin/reports/pnl/page.tsx`
  - `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` (3 places)
  - `app/admin/inventory/stocktake/components/StocktakeClient.tsx`

  The test finds the rest.
- Modify: `app/admin/inventory/items/components/ItemsClient.tsx` (add the "Bảng quy đổi" link)

- [ ] **Step 1: Write the failing test** — `app/admin/page-headings.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav-items";

// Spec 2026-09-29-menu-va-khuon-trang-design.md section 2: tapping a menu
// item lands on a page titled with the same words.
function screenSources(routeDir: string): string {
  const own = readdirSync(routeDir).filter(f => f.endsWith(".tsx") && !f.endsWith(".test.tsx")).map(f => join(routeDir, f));
  const componentsDir = join(routeDir, "components");
  const nested = existsSync(componentsDir) && statSync(componentsDir).isDirectory()
    ? readdirSync(componentsDir).filter(f => f.endsWith(".tsx") && !f.endsWith(".test.tsx")).map(f => join(componentsDir, f))
    : [];
  return [...own, ...nested].map(f => readFileSync(f, "utf8")).join("\n");
}

const links = NAV_GROUPS.flatMap(g => (g.href ? [{ name: g.name, href: g.href }] : g.children ?? []));

describe("page headings match the menu", () => {
  it.each(links)("$href is titled \"$name\"", ({ name, href }) => {
    const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
    const src = screenSources(dir);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const heading = new RegExp(`<h1[^>]*>\\s*${escaped}\\s*</h1>|title="${escaped}"`);
    expect(src).toMatch(heading);
  });
});
```

- [ ] **Step 2: Run to watch it fail**

Run: `npx vitest run app/admin/page-headings.test.ts`
Expected: FAIL for each page whose heading differs (at least the 7 files listed above), by wrong value. Save the list of failing routes; it is the work list.

- [ ] **Step 3: Rename each heading to exactly the menu name.**
  - Keep subtitles.
  - Keep `font-display` and existing sizes.
  - Where a page has no `<h1>`/`PageHeader` at all, add `PageHeader title="…"` from `components/ui/PageHeader.tsx` at the top of that page's client component.
  - The purchase-orders page is not renamed here; Task 8 rebuilds it with the heading "Phiếu nhập".

- [ ] **Step 4: "Bảng quy đổi" link.** In `ItemsClient.tsx`, beside the page heading, add `<Link href="/admin/inventory/conversions">Bảng quy đổi</Link>` styled as a secondary button (`border border-border bg-surface-card text-text-primary rounded-button h-11 px-4`).

- [ ] **Step 5: Run to watch it pass**

Run: `npx vitest run app/admin/page-headings.test.ts` → Expected: PASS for every route except `/admin/inventory/purchase-orders`, which passes after Task 8. Mark that one case `it.skip` with the comment `// green in Task 8`, and Task 8 removes the skip.

- [ ] **Step 6: Commit**

```bash
git add app/admin
git commit -m "feat(ui): page headings use the menu names; Bảng quy đổi opens from Hàng hoá"
```

### Task 8: Phiếu nhập list on the shared template, with the day picker

**Files:**
- Modify: `app/admin/inventory/purchase-orders/page.tsx`
- Rewrite: `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`
- Create: `components/ui/DayInput.tsx` (shared; step 4 reuses it)
- Test: `components/ui/DayInput.test.tsx`
- Modify: `app/admin/page-headings.test.ts` (remove the skip)

**Interfaces:**
- Consumes:
  - `getPurchaseOrdersPage(filters)` and `PurchaseOrderListPage` (Task 3).
  - `parseVnDay`, `formatVnDay` (Task 1).
  - `useFilterForm` from `lib/shared/use-filter-form.ts`.
  - `formatNumber` from `lib/shared/format.ts`.
- Produces: `DayInput` with props `{ label: string; value: string /* YYYY-MM-DD or "" */; onChange(value: string): void; error?: string }`.
  - Typing and the calendar both report `YYYY-MM-DD`.
  - Unparseable text reports `"invalid"`, so the form can show "Ngày không hợp lệ".

- [ ] **Step 1: Write the failing DayInput test** — `components/ui/DayInput.test.tsx`. Use the render setup of existing component tests such as `components/ui/MoneyInput.test.tsx`.

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DayInput } from "./DayInput";

afterEach(cleanup);

describe("DayInput", () => {
  it("shows the stored day as dd/mm/yyyy", () => {
    render(<DayInput label="Từ ngày" value="2026-09-01" onChange={() => {}} />);
    expect((screen.getByLabelText("Từ ngày") as HTMLInputElement).value).toBe("01/09/2026");
  });
  it("reports a typed day as YYYY-MM-DD on blur", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "23/09/2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("2026-09-23");
  });
  it("reports an impossible day as invalid", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "31/02/2026" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("invalid");
  });
  it("reports an emptied box as no filter", () => {
    const onChange = vi.fn();
    render(<DayInput label="Từ ngày" value="2026-09-01" onChange={onChange} />);
    const input = screen.getByLabelText("Từ ngày");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});
```

This follows the setup of `components/ui/MoneyInput.test.tsx`.

- [ ] **Step 2: Run to watch it fail**

Run: `npx vitest run components/ui/DayInput.test.tsx`
Expected: FAIL on import.

- [ ] **Step 3: Build `DayInput`.**
  - A text input with `inputMode="numeric"` and placeholder `dd/mm/yyyy`, plus a calendar button that opens `CustomDatePicker` with `showTimeSelect={false}` and `dateFormat="dd/MM/yyyy"`.
  - The visible label comes from `label`.
  - On blur or Enter: empty → `""`; `parseVnDay` succeeds → that value; otherwise `"invalid"`.
  - The `error` prop renders below the box in `text-danger`.
  - No native `type="date"`.

- [ ] **Step 4: Run to watch it pass**

Run: `npx vitest run components/ui/DayInput.test.tsx` → Expected: PASS.

- [ ] **Step 5: Rebuild the page.**

  `page.tsx`:
  - Read `searchParams` `{ q, status, supplier, from, to, page }`. Keep supporting the old `?supplier=` link from the supplier screen; it maps to `supplier`.
  - Call `getPurchaseOrdersPage`.
  - Pass the result to the client.

  `PurchaseOrdersClient.tsx` (spec §3.5):
  - **Header:**
    - Small group label "Nhập hàng".
    - `<h1>` "Phiếu nhập".
    - Primary button "Tạo phiếu nhập" linking to `/admin/inventory/purchase-orders/new`.
  - **Filters:**
    - Search box, "Tìm mã phiếu, nhà cung cấp, mặt hàng…".
    - Trạng thái (Tất cả / Nháp / Hoàn thành).
    - Nhà cung cấp (Tất cả + `suppliers`).
    - Từ ngày and Đến ngày, both `DayInput`.
    - Buttons "Lọc" and "Xoá lọc".
    - Use `useFilterForm`. Apply on "Lọc" or Enter; applying resets to page 1.
    - Validation before applying:
      - Either day is `"invalid"` → show "Ngày không hợp lệ" under it and do not apply.
      - Both set and from > to → show "Ngày bắt đầu phải trước ngày kết thúc" and do not apply.
    - If the server still returns `rangeError` from a hand-typed URL, show the same message above the table.
  - **Desktop table (`md:`):**
    - Columns: Mã phiếu, Ngày nhập (`dateText`, `whitespace-nowrap tabular-nums`), Nhà cung cấp (`truncate max-w-[280px]`, `title` = full name), Nguồn mua, Trạng thái, Tổng tiền (right-aligned, `formatNumber(totalAmount)` + "đ").
    - Badge text: `DRAFT` → "Nháp", `COMPLETED` → "Hoàn thành", anything else shown as stored.
    - The whole row is a link to `/admin/inventory/purchase-orders/<id>`. Use an `<a>` covering the row, reachable by Tab, opened with Enter. No "Xem" column.
  - **Phone cards (below `md:`):**
    - Line 1: code and total.
    - Line 2: supplier (`line-clamp-2`).
    - Line 3: `dateText` · source, and the badge.
    - The whole card is one link.
  - **Footer:**
    - "`firstIndex`–`lastIndex` trên `total` phiếu", plus Trước / page numbers / Sau.
    - Links carry every current filter plus `page`.
    - Show at most 5 page numbers around the current one.
  - **Empty:** "Không có phiếu nào khớp bộ lọc" with a "Xoá lọc" button. With no filters and no slips at all: "Chưa có phiếu nhập nào".

- [ ] **Step 6: Remove the Task 7 skip, then run everything**

Run:
- `npx vitest run` → Expected: PASS, no skips added by this plan.
- `npx tsc --noEmit` → Expected: clean.
- `npm run build` → Expected: green.

Then run `grep -rn "getPurchaseOrdersData" app lib`. If the only hit is its definition, report it as dead code for Opus to raise with the owner. Do not delete it.

- [ ] **Step 7: Commit**

```bash
git add app/admin/inventory/purchase-orders components/ui/DayInput.tsx components/ui/DayInput.test.tsx app/admin/page-headings.test.ts
git commit -m "feat(ui): Phiếu nhập list on the shared template: 20 per page, newest first, day filters"
```

---

## Opus review and hand-back (not a coding task)

1. **Diff review.** Review each part's diff against the spec, using the `reviewer` agent on Part A and on Part B.
2. **Playwright pass.**
   - Log in and check at 1280×800 and 375×812:
     - Every menu item opens its page.
     - The sidebar collapses, and stays collapsed after a reload.
     - A private window opens with the menu expanded.
     - "Thêm" lists all 6 groups.
     - The POS button opens the outlet picker.
     - The Phiếu nhập list shows PO-191 first and "1–20 trên 191 phiếu", and "Từ 23/09/2026" keeps PO-188.
     - PO-181's long supplier name is cut, and the 375px page does not scroll sideways.
   - Screenshot each.
3. **Business rules.** None change in this plan. `BR-DATA-006` is already written; Task 8 is its first screen.
4. **Hand-back.** Tell the owner in Vietnamese what to open and look at, per CLAUDE.md. Ask separately about pushing.
