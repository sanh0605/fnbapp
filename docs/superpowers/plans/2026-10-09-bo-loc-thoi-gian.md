# Bộ lọc thời gian kiểu Looker — kế hoạch (BR-UI-007)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một nút lọc thời gian dùng chung cho Đơn hàng, Phiếu nhập, Phiếu xuất, Nhật ký, Sổ thu chi, Tổng quan, Doanh số và Lãi lỗ; danh sách mở ra Tháng này và gõ tìm là tìm mọi ngày; Tổng quan và Doanh số so với kỳ trước; Lãi lỗ lọc theo trọn tháng; bỏ trang Tổng kết ngày.

**Architecture:** Cách tính nằm ở ba chỗ thuần tính toán: `lib/shared/date-range-presets.ts` (16 khoảng, có sẵn), `lib/shared/date-range-params.ts` (đọc, ghi địa chỉ trang), `lib/reports/compare-periods.ts` (kỳ so). Trang máy chủ đọc khoảng từ địa chỉ trang rồi truyền giá trị đã tính xuống; thành phần `components/ui/DateRangeButton.tsx` chỉ hiển thị và báo thay đổi. Sonnet làm phần `lib/` và server action; Gemini làm màn hình và `page.tsx`; Opus viết test chấp nhận trước, soát lại, làm tài liệu và các việc xoá.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, `react-datepicker` 9 (lịch nằm sẵn trong bảng, không bật hộp), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-bo-loc-thoi-gian-design.md` (chủ quán duyệt 2026-10-09: *"Duyệt kế hoạch docs/superpowers/specs/2026-10-09-bo-loc-thoi-gian-design.md"*). Luật: `BR-UI-007` trong `docs/02-rules/business-rules/screens.md`.

## Hiện trạng

Đo 2026-10-09. Phần năm câu chính nằm trong spec mục 1; ở đây chỉ ghi điều kế hoạch cần thêm.

1. **Trạng thái.** Không thêm bảng dữ liệu. Khoảng đang dùng nằm trên địa chỉ trang (`range`, `from`, `to`). Danh sách có thêm trạng thái "đang tìm" (ô tìm có chữ: khoảng ngày tạm gác, vẫn giữ trên địa chỉ trang).
2. **Nút.** Theo spec mục 1 câu 2. Nút "Lọc" của Doanh số giữ cho ba ô Thương hiệu, Nhân viên, Nhóm SP; đổi khoảng ngày thì lọc ngay.
3. **Danh sách khoảng.** Máy tính 16, điện thoại 9 (`PHONE_PRESET_KEYS`), Lãi lỗ 7 + Tuỳ chọn (`MONTH_PRESET_KEYS`), cùng khai trong `date-range-presets.ts`.
4. **Ô nhập.** Hai ô `DayInput` "Từ ngày", "Đến ngày" (sai: "Ngày không hợp lệ"; đầu sau cuối: "Ngày đầu phải trước ngày cuối"); Lãi lỗ hai ô tháng (đầu sau cuối: "Tháng đầu phải trước tháng cuối"). Địa chỉ trang sửa tay sai thì dùng khoảng mặc định, không báo lỗi.
5. **Phục vụ gì, cố ý không phục vụ gì.** Như spec mục 1 câu 5. Không đụng Giá trị xuất kho, ô ngày trong biểu mẫu nhập liệu, máy bán hàng (`app/pos`).

Câu hỏi riêng của việc này:

6. **Có làm máy bán hàng ngừng nhận đơn không?** Không. Không file nào trong `app/pos`, không migration, không ghi dữ liệu. Chỉ đọc.
7. **Đường dẫn cũ.** `from=…&to=…` không kèm `range` vẫn là Tuỳ chọn (các dòng bấm từ Sổ thu chi). `year=` của Lãi lỗ vẫn đọc. `filter=` (Tổng quan), `preset/start/end` (Sổ thu chi), `start/end` (Doanh số) thôi đọc, mở ra mặc định.
8. **Code chết và test bị xoá, vì sao.** `components/ui/DateRangeFilter.tsx` và test (thay bằng `DateRangeButton`, test mới phủ cùng hành vi); `app/admin/finance/resolve-date-range.ts` và test (chuyển vào `date-range-params`, các ca chuyển theo); `resolveDashboardPeriods` và test của nó (thay bằng kỳ so chung; ca giờ Sài Gòn chuyển sang `inSaigonDayRange`); `app/admin/reports/daily/` và `lib/reports/daily-digest.ts` cùng test (chủ quán bỏ trang); `YearSelect.tsx` (Lãi lỗ thôi chọn năm). `listAvailableYears` giữ lại vì `scripts/verify-pnl-monthly.ts` dùng nó để soát từng năm.
9. **Ví dụ bằng số thật** (đo trên máy chủ 2026-10-09 lúc 16:55, đơn `COMPLETED` không bị thay thế, cộng `net_total`, ngày theo giờ Việt Nam; cùng cách Tổng quan đang tính):

   | Đang xem | Số | Kỳ so | Số | Thay đổi doanh thu | Thay đổi số đơn |
   |---|---|---|---|---|---|
   | Tháng này, 01/10–09/10 | 251 đơn, 6,563,000đ | 01/09–09/09 | 172 đơn, 4,199,000đ | ▲ 56.3% | ▲ 45.9% |
   | Hôm nay 09/10 (tới 16:55) | 33 đơn, 838,000đ | hôm qua 08/10 | 26 đơn, 714,000đ | ▲ 17.4% | ▲ 26.9% |
   | | | thứ Sáu 02/10 | 37 đơn, 1,021,000đ | ▼ 17.9% | ▼ 10.8% |
   | Hôm qua 08/10 | 26 đơn, 714,000đ | 07/10 | 21 đơn, 571,000đ | ▲ 25.0% | |
   | | | thứ Năm 01/10 | 35 đơn, 830,000đ | ▼ 14.0% | |

   Chủ quán đối chiếu trên Tổng quan: chọn Tháng này, thẻ "Tổng doanh thu" phải ghi 6,563,000 (cộng đơn bán thêm sau 16:55) và dòng "▲ … so với 01/09 – 09/09". Số hôm nay đổi theo giờ mở trang; số tháng 9 và ngày 08/10, 07/10, 02/10, 01/10 không đổi nữa, trừ khi có đơn bị sửa.

Đã xem: toàn bộ các file spec mục 1 liệt kê; thêm `app/admin/page.tsx` (cả file), `app/admin/page.test.tsx`, `getSalesDataV2` dòng 382–520 và `findCompletedOrders`, `OrderTable.tsx` dòng 75–200, `app/admin/activity-log/actions.ts` (ô tìm: mã đơn, `id`, `reason`, `actor_name`), `app/admin/reports/pnl/actions.ts`, `profit-and-loss.ts` dòng 270–300, `profit-and-loss-table.ts` dòng 55–80 và 280–310, `PnlSummary.tsx` dòng 15–40, `app/admin/finance/page.tsx`, chỗ `CashBookClient.tsx` dùng `DateRangeFilter`, `nav-items.ts`, `next.config.js`, `lib/shared/timezone-guard.test.ts`.
Chưa xem: thân `IssueSlipsClient`, `PurchaseOrdersClient`, `ActivityLogClient` ngoài các dòng lọc; `PnlTableView`, `PnlMonthCards`, `PnlChart` ngoài các dòng có `year`; thân trang Tổng kết ngày. Gemini đọc khi làm, Opus đọc khi soát.

## Global Constraints

- Every day is the Asia/Saigon day: pages compute `today` with `saigonToday()` and pass it down; `lib/` date math goes through `date-range-presets.ts` helpers; `lib/shared/timezone-guard.test.ts` stays green with no new allowlist line.
- One URL scheme: `range=<DateRangePresetKey>`; `from`, `to` only with `CUSTOM` (`yyyy-mm-dd`; Lãi lỗ `yyyy-mm`). `from`+`to` without `range` = `CUSTOM`. Anything invalid = the page default, silently.
- Defaults: lists, Sổ thu chi, Tổng quan, Doanh số `THIS_MONTH`; Lãi lỗ `THIS_YEAR`.
- Button text: `"<tên khoảng> · <dd/mm/yyyy – dd/mm/yyyy>"`, one day as one date; Lãi lỗ `mm/yyyy – mm/yyyy`.
- A ready range applies at once; calendar or typed days apply only on "Áp dụng".
- No popup: the panel is anchored under the button (desktop) or in the page flow (phone); no `FormModal`, `ModalPortal`, `fixed inset-0`, `withPortal`; `app/admin/no-popups.test.ts` green with no new name.
- Two layouts (`.claude/rules/ui-devices.md`): desktop panel = 16 ranges left, two day boxes and two inline months right; phone = 3×3 buttons (`PHONE_PRESET_KEYS`), Tuỳ chọn = two day boxes and one inline month; every control ≥ 44px.
- Lists: while `q` is non-empty the server ignores the day range and keeps every other filter; the button is disabled with the line "Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày".
- Compare (Tổng quan, Doanh số only): one line per compare period under the card's figure, `"▲ 12.5% so với 01/09 – 09/09"`; previous figure 0 → `"Kỳ trước chưa có số"`; percentages one decimal, dot mark, through `formatDecimal` (`BR-UI-008`).
- Shared templates only (`BR-UI-005`): `Button`, `Field`, `DayInput`, `EmptyState`, `PageHeader`; all visible text Vietnamese.
- Never delete a test without the reason in the commit message (reasons in Hiện trạng câu 8).

## Review Focus

1. **Early morning.** At 06:30 Saigon (23:30 UTC the day before) "Hôm nay" and "Tháng này" are the Saigon day: on 01/10 at 06:30 Tháng này is October, not September. Pinned in Task 1 (`today` is always passed in) and Task 6 (dashboard page test with the clock at `2026-09-30T23:30:00Z`).
2. **A code from last month.** On Phiếu xuất at Tháng này, typing `ISL-00053` (08/09) finds it; clearing the box brings back October; the status filter still applies while searching. Pinned in Task 4.
3. **Sổ thu chi day link.** `/admin/orders?from=2026-10-05&to=2026-10-05&payment=Tien%20mat` shows only 05/10 and the button reads "Tuỳ chọn · 05/10/2026". Pinned in Task 1 and Task 4.
4. **Lãi lỗ bookmark.** `/admin/reports/pnl?year=2025` shows 01/2025–12/2025, twelve columns. Pinned in Task 1 and Task 8.
5. **Half-typed custom range.** Typing `31/02/2026` keeps "Áp dụng" disabled, shows "Ngày không hợp lệ", and the page keeps its range; "Huỷ" restores the old range in the button. Pinned in Task 3.

---

### Task 1: Đọc, ghi khoảng trên địa chỉ trang (Sonnet)

**Files:**
- Modify: `lib/shared/date-range-presets.ts` (export helpers and key lists)
- Create: `lib/shared/date-range-params.ts`, `lib/shared/date-range-params.test.ts`
- Delete (Task 3, after its last caller moves): `app/admin/finance/resolve-date-range.ts` and its test — its cases are ported here in Step 1.

**Interfaces:**
- Produces:
  ```ts
  // date-range-presets.ts (new exports; existing ones unchanged)
  export const PHONE_PRESET_KEYS: readonly DateRangePresetKey[]; // TODAY, YESTERDAY, THIS_WEEK, LAST_WEEK, THIS_MONTH, LAST_MONTH, THIS_QUARTER, THIS_YEAR, CUSTOM
  export const MONTH_PRESET_KEYS: readonly DateRangePresetKey[]; // THIS_MONTH, LAST_MONTH, THIS_QUARTER, LAST_QUARTER, THIS_YEAR, LAST_YEAR, YEAR_TO_DATE, CUSTOM
  export function presetLabel(key: DateRangePresetKey): string;
  export function startOfWeek(iso: string): string;            // Monday
  export function endOfMonth(iso: string): string;
  export function addMonths(iso: string, months: number): string; // clamps to the month's last day
  export function isValidIsoDay(value: string): boolean;
  // date-range-params.ts
  export type RawParams = Record<string, string | string[] | undefined>;
  export interface RangeValue { preset: DateRangePresetKey; start: string; end: string } // yyyy-mm-dd, or yyyy-mm in month mode
  export function readRangeParams(params: RawParams, today: string, fallback: DateRangePresetKey): RangeValue;
  export function readMonthRangeParams(params: RawParams, today: string): RangeValue;
  export function writeRangeParams(params: URLSearchParams, value: RangeValue): void;
  export function formatRangeButtonText(value: RangeValue, mode?: "day" | "month"): string;
  ```

- [ ] **Step 1 (Opus): write the failing test** `lib/shared/date-range-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatRangeButtonText, readMonthRangeParams, readRangeParams, writeRangeParams } from "./date-range-params";
import { MONTH_PRESET_KEYS, PHONE_PRESET_KEYS, addMonths } from "./date-range-presets";

const TODAY = "2026-10-09"; // a Friday

describe("readRangeParams", () => {
  it("no params gives the page default resolved against today", () => {
    expect(readRangeParams({}, TODAY, "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
  it("a known range resolves against today", () => {
    expect(readRangeParams({ range: "LAST_7_DAYS" }, TODAY, "THIS_MONTH")).toEqual({ preset: "LAST_7_DAYS", start: "2026-10-02", end: "2026-10-08" });
  });
  it("CUSTOM keeps valid from/to", () => {
    expect(readRangeParams({ range: "CUSTOM", from: "2026-09-15", to: "2026-09-24" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" });
  });
  it("from/to without range read as CUSTOM -- the Sổ thu chi day links", () => {
    expect(readRangeParams({ from: "2026-10-05", to: "2026-10-05", payment: "Tien mat" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "CUSTOM", start: "2026-10-05", end: "2026-10-05" });
  });
  it("a ready range ignores stray from/to", () => {
    expect(readRangeParams({ range: "YESTERDAY", from: "2026-01-01", to: "2026-01-02" }, TODAY, "THIS_MONTH"))
      .toEqual({ preset: "YESTERDAY", start: "2026-10-08", end: "2026-10-08" });
  });
  it.each([
    [{ range: "NOPE" }],
    [{ range: "CUSTOM", from: "abc", to: "2026-10-01" }],
    [{ range: "CUSTOM", from: "2026-02-30", to: "2026-03-01" }],
    [{ range: "CUSTOM", from: "2026-13-01", to: "2026-12-31" }],
    [{ range: "CUSTOM", from: "2026-10-09", to: "2026-10-01" }],
    [{ range: "CUSTOM", from: "2026-10-01" }],
    [{ from: "2026-10-01" }],
  ])("falls back to the default for %j", params => {
    expect(readRangeParams(params, TODAY, "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
  it("accepts 29/02 in a leap year", () => {
    expect(readRangeParams({ range: "CUSTOM", from: "2028-02-29", to: "2028-03-01" }, TODAY, "THIS_MONTH").start).toBe("2028-02-29");
  });
  it("takes the first value of a repeated param", () => {
    expect(readRangeParams({ range: ["TODAY", "YESTERDAY"] }, TODAY, "THIS_MONTH").preset).toBe("TODAY");
  });
  it("uses the today it is given -- 06:30 on 01/10 in Saigon is October", () => {
    expect(readRangeParams({}, "2026-10-01", "THIS_MONTH")).toEqual({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" });
  });
});

describe("readMonthRangeParams (Lãi lỗ)", () => {
  it("defaults to Năm nay, ending at the current month", () => {
    expect(readMonthRangeParams({}, TODAY)).toEqual({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
  });
  it.each([
    ["THIS_MONTH", "2026-10", "2026-10"],
    ["LAST_MONTH", "2026-09", "2026-09"],
    ["THIS_QUARTER", "2026-10", "2026-10"],
    ["LAST_QUARTER", "2026-07", "2026-09"],
    ["LAST_YEAR", "2025-01", "2025-12"],
    ["YEAR_TO_DATE", "2026-01", "2026-10"],
  ])("%s gives %s..%s", (range, start, end) => {
    expect(readMonthRangeParams({ range }, TODAY)).toEqual({ preset: range, start, end });
  });
  it("Quý trước in January is the last quarter of the year before", () => {
    expect(readMonthRangeParams({ range: "LAST_QUARTER" }, "2027-01-15")).toEqual({ preset: "LAST_QUARTER", start: "2026-10", end: "2026-12" });
  });
  it("CUSTOM months may cross a year", () => {
    expect(readMonthRangeParams({ range: "CUSTOM", from: "2025-07", to: "2026-06" }, TODAY)).toEqual({ preset: "CUSTOM", start: "2025-07", end: "2026-06" });
  });
  it("an old ?year=2025 bookmark opens all of 2025", () => {
    expect(readMonthRangeParams({ year: "2025" }, TODAY)).toEqual({ preset: "CUSTOM", start: "2025-01", end: "2025-12" });
  });
  it.each([
    [{ range: "LAST_7_DAYS" }],
    [{ range: "CUSTOM", from: "2026-13", to: "2026-12" }],
    [{ range: "CUSTOM", from: "2026-06", to: "2026-01" }],
    [{ year: "20x5" }],
  ])("falls back to Năm nay for %j", params => {
    expect(readMonthRangeParams(params, TODAY)).toEqual({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" });
  });
});

describe("writeRangeParams", () => {
  it("a ready range writes only range and drops from/to; other params stay", () => {
    const p = new URLSearchParams("q=sữa&from=2026-01-01&to=2026-01-31&status=DONE");
    writeRangeParams(p, { preset: "LAST_MONTH", start: "2026-09-01", end: "2026-09-30" });
    expect(p.get("range")).toBe("LAST_MONTH");
    expect(p.has("from")).toBe(false);
    expect(p.has("to")).toBe(false);
    expect(p.get("q")).toBe("sữa");
    expect(p.get("status")).toBe("DONE");
  });
  it("CUSTOM writes range, from and to", () => {
    const p = new URLSearchParams();
    writeRangeParams(p, { preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" });
    expect(p.toString()).toBe("range=CUSTOM&from=2026-09-15&to=2026-09-24");
  });
});

describe("formatRangeButtonText", () => {
  it("names the range and its days", () => {
    expect(formatRangeButtonText({ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" })).toBe("Tháng này · 01/10/2026 – 31/10/2026");
    expect(formatRangeButtonText({ preset: "TODAY", start: "2026-10-09", end: "2026-10-09" })).toBe("Hôm nay · 09/10/2026");
    expect(formatRangeButtonText({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" })).toBe("Tuỳ chọn · 15/09/2026 – 24/09/2026");
  });
  it("month mode writes months", () => {
    expect(formatRangeButtonText({ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" }, "month")).toBe("Năm nay · 01/2026 – 10/2026");
    expect(formatRangeButtonText({ preset: "THIS_MONTH", start: "2026-10", end: "2026-10" }, "month")).toBe("Tháng này · 10/2026");
  });
});

describe("preset lists and helpers", () => {
  it("the phone shows nine buttons in the owner's order", () => {
    expect(PHONE_PRESET_KEYS).toEqual(["TODAY", "YESTERDAY", "THIS_WEEK", "LAST_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "THIS_YEAR", "CUSTOM"]);
  });
  it("Lãi lỗ offers whole-month ranges only", () => {
    expect(MONTH_PRESET_KEYS).toEqual(["THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "LAST_QUARTER", "THIS_YEAR", "LAST_YEAR", "YEAR_TO_DATE", "CUSTOM"]);
  });
  it("addMonths clamps to the last day of a shorter month", () => {
    expect(addMonths("2026-10-31", -1)).toBe("2026-09-30");
    expect(addMonths("2028-02-29", -12)).toBe("2027-02-28");
    expect(addMonths("2026-01-15", -3)).toBe("2025-10-15");
  });
});
```

- [ ] **Step 2: run it.** `npx vitest run lib/shared/date-range-params.test.ts`. Expected: FAIL, "Failed to resolve import ./date-range-params" (missing module, not a wrong value).
- [ ] **Step 3 (Sonnet): implement.** Brief: Global Constraints, this task's Interfaces and test. Rules:
  - `readRangeParams`: first value of an array; `range` must be a key of `DATE_RANGE_PRESETS`; `CUSTOM` needs both `from` and `to` valid (`isValidIsoDay`, moved from `resolve-date-range.ts` with its round-trip check) and `from <= to`; no `range` but both `from`/`to` valid and ordered = `CUSTOM`; else `fallback` resolved with `resolvePreset`.
  - `readMonthRangeParams`: allowed keys `MONTH_PRESET_KEYS`; a ready range = `resolvePreset(...)` turned into months (`slice(0, 7)`), the end capped at `today.slice(0, 7)`; `CUSTOM` needs `yyyy-mm` with month 01–12 on both ends and `from <= to`, not capped; else `year=YYYY` (four digits) = `CUSTOM` Jan–Dec; else `THIS_YEAR`.
  - `writeRangeParams` never touches keys other than `range`, `from`, `to`.
  - `formatRangeButtonText`: `${presetLabel} · ${formatRangeLabel(start, end)}`; month mode `mm/yyyy`, one month as one.
  - Date math only through the helpers in `date-range-presets.ts` (`Date.UTC`, `getUTC*`); no `getDate()`, no `toISOString().slice(0, 10)` outside the line already allowlisted.
- [ ] **Step 4: run** `npx vitest run lib/shared` and `npx tsc --noEmit`. Expected: PASS (date-range-presets and timezone-guard tests included).
- [ ] **Step 5: commit** `feat(lib): one way to read and write the time filter on a page's address; Lãi lỗ reads months and old ?year= links (BR-UI-007)`.

### Task 2: Kỳ so (Sonnet)

**Files:** Create `lib/reports/compare-periods.ts`, `lib/reports/compare-periods.test.ts`.

**Interfaces:**
- Consumes: `RangeValue` (Task 1), `addDays`, `addMonths`, `startOfWeek`, `endOfMonth` (Task 1).
- Produces:
  ```ts
  export type CompareKind = "PREVIOUS" | "DAY_BEFORE" | "SAME_WEEKDAY_LAST_WEEK";
  export interface ComparePeriod { kind: CompareKind; start: string; end: string }
  export function comparePeriods(value: RangeValue, today: string): { current: DateRange | null; previous: ComparePeriod[] };
  export function compareLabel(period: ComparePeriod, current: DateRange, today: string): string;
  export function percentChange(current: number, previous: number): number | null; // null when previous is 0
  ```

- [ ] **Step 1 (Opus): failing test** `lib/reports/compare-periods.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { compareLabel, comparePeriods, percentChange } from "./compare-periods";

const T = "2026-10-09"; // Friday
const v = (preset: string, start: string, end: string) => ({ preset, start, end }) as any;
const prev = (start: string, end: string) => ({ kind: "PREVIOUS", start, end });

describe("comparePeriods -- the spec's table, on Friday 09/10/2026", () => {
  it.each([
    ["TODAY", "2026-10-09", "2026-10-09", "2026-10-09", "2026-10-09",
      [{ kind: "DAY_BEFORE", start: "2026-10-08", end: "2026-10-08" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-02", end: "2026-10-02" }]],
    ["YESTERDAY", "2026-10-08", "2026-10-08", "2026-10-08", "2026-10-08",
      [{ kind: "DAY_BEFORE", start: "2026-10-07", end: "2026-10-07" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-01", end: "2026-10-01" }]],
    ["CUSTOM", "2026-09-15", "2026-09-15", "2026-09-15", "2026-09-15",
      [{ kind: "DAY_BEFORE", start: "2026-09-14", end: "2026-09-14" }, { kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-09-08", end: "2026-09-08" }]],
    ["LAST_7_DAYS", "2026-10-02", "2026-10-08", "2026-10-02", "2026-10-08", [prev("2026-09-25", "2026-10-01")]],
    ["LAST_28_DAYS", "2026-09-11", "2026-10-08", "2026-09-11", "2026-10-08", [prev("2026-08-14", "2026-09-10")]],
    ["LAST_30_DAYS", "2026-09-09", "2026-10-08", "2026-09-09", "2026-10-08", [prev("2026-08-10", "2026-09-08")]],
    ["THIS_WEEK", "2026-10-05", "2026-10-11", "2026-10-05", "2026-10-09", [prev("2026-09-28", "2026-10-02")]],
    ["LAST_WEEK", "2026-09-28", "2026-10-04", "2026-09-28", "2026-10-04", [prev("2026-09-21", "2026-09-27")]],
    ["THIS_MONTH", "2026-10-01", "2026-10-31", "2026-10-01", "2026-10-09", [prev("2026-09-01", "2026-09-09")]],
    ["MONTH_TO_DATE", "2026-10-01", "2026-10-09", "2026-10-01", "2026-10-09", [prev("2026-09-01", "2026-09-09")]],
    ["LAST_MONTH", "2026-09-01", "2026-09-30", "2026-09-01", "2026-09-30", [prev("2026-08-01", "2026-08-31")]],
    ["THIS_QUARTER", "2026-10-01", "2026-12-31", "2026-10-01", "2026-10-09", [prev("2026-07-01", "2026-07-09")]],
    ["LAST_QUARTER", "2026-07-01", "2026-09-30", "2026-07-01", "2026-09-30", [prev("2026-04-01", "2026-06-30")]],
    ["THIS_YEAR", "2026-01-01", "2026-12-31", "2026-01-01", "2026-10-09", [prev("2025-01-01", "2025-10-09")]],
    ["YEAR_TO_DATE", "2026-01-01", "2026-10-09", "2026-01-01", "2026-10-09", [prev("2025-01-01", "2025-10-09")]],
    ["LAST_YEAR", "2025-01-01", "2025-12-31", "2025-01-01", "2025-12-31", [prev("2024-01-01", "2024-12-31")]],
    ["CUSTOM", "2026-09-15", "2026-09-24", "2026-09-15", "2026-09-24", [prev("2026-09-05", "2026-09-14")]],
    ["CUSTOM", "2026-10-01", "2026-10-20", "2026-10-01", "2026-10-09", [prev("2026-09-22", "2026-09-30")]],
  ])("%s %s..%s", (preset, start, end, curStart, curEnd, previous) => {
    expect(comparePeriods(v(preset, start, end), T)).toEqual({ current: { start: curStart, end: curEnd }, previous });
  });
});

describe("comparePeriods -- edges", () => {
  it("Tháng này on the 31st is a whole month: all of September", () => {
    expect(comparePeriods(v("THIS_MONTH", "2026-10-01", "2026-10-31"), "2026-10-31").previous).toEqual([prev("2026-09-01", "2026-09-30")]);
  });
  it("Quý này on 30/11 clamps nothing and stops at 30/08", () => {
    expect(comparePeriods(v("THIS_QUARTER", "2026-10-01", "2026-12-31"), "2026-11-30").previous).toEqual([prev("2026-07-01", "2026-08-30")]);
  });
  it("Năm nay on 29/02/2028 compares with 01/01–28/02/2027", () => {
    expect(comparePeriods(v("THIS_YEAR", "2028-01-01", "2028-12-31"), "2028-02-29").previous).toEqual([prev("2027-01-01", "2027-02-28")]);
  });
  it("Quý trước in January is Q4 against Q3", () => {
    expect(comparePeriods(v("LAST_QUARTER", "2026-10-01", "2026-12-31"), "2027-01-15").previous).toEqual([prev("2026-07-01", "2026-09-30")]);
  });
  it("Tháng này on the 1st is a month with one day so far: one compare, 01/09", () => {
    expect(comparePeriods(v("THIS_MONTH", "2026-10-01", "2026-10-31"), "2026-10-01")).toEqual({
      current: { start: "2026-10-01", end: "2026-10-01" }, previous: [prev("2026-09-01", "2026-09-01")],
    });
  });
  it("a range starting after today has nothing to compare", () => {
    expect(comparePeriods(v("CUSTOM", "2026-10-15", "2026-10-20"), T)).toEqual({ current: null, previous: [] });
  });
});

describe("compareLabel", () => {
  const today = { start: T, end: T };
  it("the day before today is 'hôm qua'", () => {
    expect(compareLabel({ kind: "DAY_BEFORE", start: "2026-10-08", end: "2026-10-08" }, today, T)).toBe("so với hôm qua");
  });
  it("the day before another day names the date", () => {
    expect(compareLabel({ kind: "DAY_BEFORE", start: "2026-10-07", end: "2026-10-07" }, { start: "2026-10-08", end: "2026-10-08" }, T)).toBe("so với 07/10");
  });
  it("the same weekday names the weekday", () => {
    expect(compareLabel({ kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-02", end: "2026-10-02" }, today, T)).toBe("so với thứ Sáu 02/10");
    expect(compareLabel({ kind: "SAME_WEEKDAY_LAST_WEEK", start: "2026-10-04", end: "2026-10-04" }, { start: "2026-10-11", end: "2026-10-11" }, T)).toBe("so với Chủ nhật 04/10");
  });
  it("a period names its days, with the year only when it is not this year", () => {
    expect(compareLabel(prev("2026-09-01", "2026-09-09") as any, { start: "2026-10-01", end: T }, T)).toBe("so với 01/09 – 09/09");
    expect(compareLabel(prev("2025-01-01", "2025-10-09") as any, { start: "2026-01-01", end: T }, T)).toBe("so với 01/01/2025 – 09/10/2025");
  });
});

describe("percentChange", () => {
  it("is the change against the previous figure", () => {
    expect(percentChange(6563000, 4199000)).toBeCloseTo(56.2991, 3);
    expect(percentChange(838000, 1021000)).toBeCloseTo(-17.9236, 3);
  });
  it("is null when the previous figure is 0", () => {
    expect(percentChange(838000, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: run** `npx vitest run lib/reports/compare-periods.test.ts`. Expected: FAIL, missing module.
- [ ] **Step 3 (Sonnet): implement** (spec 5.2, rules copied into the brief):
  - `current` = `{ start, end: min(end, today) }`; `null` and no compares when `start > today`.
  - `start === end` of the **value** (not of `current`): `DAY_BEFORE` = −1 day, `SAME_WEEKDAY_LAST_WEEK` = −7 days.
  - Unit presets: week (`THIS_WEEK`, `LAST_WEEK`), month (`THIS_MONTH`, `LAST_MONTH`, `MONTH_TO_DATE`), quarter (`THIS_QUARTER`, `LAST_QUARTER`, 3 months), year (`THIS_YEAR`, `LAST_YEAR`, `YEAR_TO_DATE`, 12 months). Previous start = start shifted back one unit. If `current.end` is the last day of the unit that starts at `start`, previous end = the day before `start`; else previous end = `current.end` shifted back one unit (`addMonths` clamps; week −7 days).
  - Everything else (`LAST_7/28/30_DAYS`, `CUSTOM` of several days): `n` = days in `current`; previous = the `n` days ending the day before `start`.
  - Weekday names from `getUTCDay()` on a `Date.UTC` date: Chủ nhật, thứ Hai, thứ Ba, thứ Tư, thứ Năm, thứ Sáu, thứ Bảy.
- [ ] **Step 4: run** `npx vitest run lib/reports lib/shared` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: commit** `feat(lib): the compare period for Tổng quan and Doanh số — same days of the period before; one day against the day before and the same weekday last week (BR-UI-007)`.

### Task 3: Nút bộ lọc dùng chung; Sổ thu chi chuyển sang (Gemini)

**Files:**
- Create: `components/ui/DateRangeButton.tsx`, `components/ui/DateRangeButton.test.tsx`
- Modify: `app/admin/finance/page.tsx`, `app/admin/finance/components/CashBookClient.tsx`, `lib/finance/cash-book-rows.ts` (day links add `range=CUSTOM`, Opus), its test
- Delete: `components/ui/DateRangeFilter.tsx` + test, `app/admin/finance/resolve-date-range.ts` + test

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  ```ts
  export function DateRangeButton(props: {
    value: RangeValue;
    onChange: (next: RangeValue) => void;
    today: string;               // yyyy-mm-dd, Saigon
    mode?: "day" | "month";      // default "day"
    disabled?: boolean;
    disabledHint?: string;       // shown under the button when disabled
  }): JSX.Element;
  ```

- [ ] **Step 1 (Opus): failing test** `components/ui/DateRangeButton.test.tsx` (jsdom; `matchMedia` stub as in today's `DateRangeFilter.test.tsx`). Both layouts render; scope queries with `within(screen.getByTestId("range-panel-desktop"))` / `"range-panel-phone"`. Cases, `today="2026-10-09"`, value Tháng này:
  1. The button reads "Tháng này · 01/10/2026 – 31/10/2026"; the panel is closed (no `range-panel-*` in the document).
  2. Click the button: desktop panel lists 16 range buttons in `DATE_RANGE_PRESETS` order; phone panel has exactly the 9 `PHONE_PRESET_KEYS` labels.
  3. Click "Tháng trước" (desktop) → `onChange({ preset: "LAST_MONTH", start: "2026-09-01", end: "2026-09-30" })` once, panel closes.
  4. Click "Tuỳ chọn" → no `onChange`; "Từ ngày", "Đến ngày" and a disabled "Áp dụng" appear.
  5. Type `15/09/2026` and `24/09/2026`, blur, click "Áp dụng" → `onChange({ preset: "CUSTOM", start: "2026-09-15", end: "2026-09-24" })`.
  6. Type `31/02/2026` → "Ngày không hợp lệ", "Áp dụng" disabled, no `onChange`.
  7. Type `24/09/2026` then `15/09/2026` → "Ngày đầu phải trước ngày cuối", "Áp dụng" disabled.
  8. Open Tuỳ chọn, type a day, click "Huỷ" → panel closes, button still "Tháng này · …", no `onChange`. Same for `Escape`.
  9. `value` `LAST_7_DAYS` 02/10–08/10: button "7 ngày qua · 02/10/2026 – 08/10/2026"; in the phone panel no button has `aria-pressed="true"`.
  10. `disabled` + `disabledHint="Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày"`: button disabled, hint visible, click opens nothing.
  11. `mode="month"`, value Năm nay 2026-01..2026-10: button "Năm nay · 01/2026 – 10/2026"; desktop list = the 8 `MONTH_PRESET_KEYS` labels; Tuỳ chọn shows "Từ tháng", "Đến tháng"; choosing 07/2025 and 06/2026 then "Áp dụng" → `onChange({ preset: "CUSTOM", start: "2025-07", end: "2026-06" })`; 06/2026 then 01/2026 → "Tháng đầu phải trước tháng cuối".
  12. The source contains none of `fixed inset-0`, `withPortal`, `ModalPortal`, `FormModal` (read the file text).
  Run `npx vitest run components/ui/DateRangeButton.test.tsx`. Expected: FAIL, missing module.
- [ ] **Step 2 (Gemini): brief** — `agy models` first, newest Gemini at `-high`; `agy --model <it> --mode accept-edits -p "$(cat brief)"`. Brief carries: Global Constraints; Interfaces; the test file path (make it pass, do not edit it); the clickable sample https://claude.ai/artifact/GomjK35YDJQsYBk1sajNJD (variant B, both devices) as the look; `react-datepicker` `inline`, `selectsRange`, `monthsShown={2}` desktop / `1` phone, `calendarStartDay={1}`, locale `vi`; month mode `showMonthYearPicker` inline; desktop panel absolutely positioned under the button (`z-20`), closes on outside click and `Escape`; phone panel in flow, `scrollIntoView` of the button on open; the day boxes are `DayInput` kept in sync with the calendar; selected range button `aria-pressed="true"`. Then Sổ thu chi: `finance/page.tsx` reads `readRangeParams(searchParams, today, "THIS_MONTH")` and builds `currentListUrl` with `writeRangeParams`; `CashBookClient` swaps `DateRangeFilter` for `DateRangeButton` and its `listUrl` uses `writeRangeParams`; delete `DateRangeFilter.tsx` + test and `resolve-date-range.ts` + test.
- [ ] **Step 3 (Opus):** `lib/finance/cash-book-rows.ts` `dayRowHref` writes `range=CUSTOM&from=…&to=…`; update its test's expected hrefs.
- [ ] **Step 4 (Opus): verify** `npx vitest run components/ui app/admin/finance lib/finance app/admin/no-popups.test.ts lib/shared`, `npx tsc --noEmit`; `grep -rn "DateRangeFilter\|resolve-date-range" app components lib` empty; read the diff (no popup, two layouts, 44px).
- [ ] **Step 5: commit** `feat(ui): the shared Looker-style time filter — a button with 16 ranges and two months on a computer, nine buttons on a phone; Sổ thu chi wears it (BR-UI-007)`; message names the two deleted tests and why (Hiện trạng câu 8).

### Task 4: Bốn danh sách (Gemini)

**Files:** `app/admin/orders/{page.tsx,OrderTable.tsx}`, `app/admin/inventory/issue-slips/{page.tsx,components/IssueSlipsClient.tsx}`, `app/admin/inventory/purchase-orders/{page.tsx,components/PurchaseOrdersClient.tsx}`, `app/admin/activity-log/{page.tsx,components/ActivityLogClient.tsx}`; tests beside each.

**Interfaces:**
- Consumes: `readRangeParams`, `writeRangeParams`, `formatRangeButtonText`, `DateRangeButton`.
- Produces: each client takes `range: RangeValue`, `today: string`, `searching: boolean` props from its page.

- [ ] **Step 1 (Opus): failing tests.**
  - Page tests (mock the data action, assert the filters it receives), clock at `2026-10-09T09:00:00Z`:
    - Orders `searchParams {}` → `getOrdersV2` gets `from`/`to` = Saigon bounds of 01/10 and 31/10 (`2026-09-30T17:00:00.000Z`, `2026-10-31T16:59:59.999Z`).
    - Orders `{ from: "2026-10-05", to: "2026-10-05", payment: "Tien mat" }` → bounds of 05/10 only, `payment` kept; client prop `range` = `CUSTOM 2026-10-05..2026-10-05`.
    - Orders `{ q: "PHD000123" }` → `from`, `to` undefined, `q` kept; `searching` true.
    - Phiếu xuất `{ q: "ISL-00053", kind: "MANUAL" }` → `getIssueSlipsPage` gets `from`, `to` undefined and `kind: "MANUAL"`; `{}` → `from: "2026-10-01"`, `to: "2026-10-31"`.
    - Phiếu nhập `{ q: "sữa tươi", supplier: "NCC-001" }` → no `from`/`to`, `supplier` kept; `{ range: "LAST_MONTH" }` → `2026-09-01`..`2026-09-30`.
    - Nhật ký `{}` → bounds of 01/10–31/10; `{ q: "Huỷ" }` → none.
  - Client tests: Phiếu xuất with `searching` true shows "Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày" and the filter button is disabled; empty list with `q` shows "Không tìm thấy phiếu nào trên mọi ngày"; empty list without `q` shows "Không có phiếu nào trong Tháng này (01/10/2026 – 31/10/2026)"; "Xoá lọc" pushes an address with none of `range`, `from`, `to`, `kind`, `person`, `q`. Choosing "Tháng trước" pushes `range=LAST_MONTH` and no `page`. The old "Từ ngày"/"Đến ngày" `DayInput`s are gone from all four clients.
  Run the four folders. Expected: FAIL (pages pass nothing when params are empty; no `searching` prop).
- [ ] **Step 2 (Gemini): brief.** Pages: `const today = saigonToday(); const range = readRangeParams(searchParams, today, "THIS_MONTH"); const searching = Boolean(q?.trim());` and pass the range to the data call only when not searching (orders and Nhật ký through their existing Saigon start/end helpers; Phiếu xuất and Phiếu nhập as `yyyy-mm-dd`). Clients: drop the from/to state, refs, errors and the two `DayInput`s; put `DateRangeButton` where the day boxes were (first in the filter row on a computer, full width on a phone); on change `writeRangeParams` + delete `page` + `router.push`; disabled with the hint while searching; empty-state wording above (orders "đơn hàng", Nhật ký "nhật ký" in place of "phiếu"); "Xoá lọc" clears the range too. Keep every other filter and the `returnTo` links.
- [ ] **Step 3 (Opus): verify** `npx vitest run app/admin/orders app/admin/inventory/issue-slips app/admin/inventory/purchase-orders app/admin/activity-log lib/stock lib/purchasing`, tsc, read the diff (server ignores the range only when searching; no day box left).
- [ ] **Step 4: commit** `feat(ui): Đơn hàng, Phiếu nhập, Phiếu xuất and Nhật ký open on Tháng này with the shared filter; anything typed in search looks through every day (BR-UI-007)`.

### Task 5: Số liệu kỳ so cho Tổng quan và Doanh số (Sonnet)

**Files:**
- Modify: `lib/reports/dashboard-periods.ts`, its test
- Create: `lib/reports/sales-totals.ts`, `lib/reports/sales-totals.test.ts`
- Modify: `app/admin/reports/actions.ts` (`getSalesDataV2` uses `computeSalesTotals`; new `getSalesTotalsV2`), `app/admin/reports/actions.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // dashboard-periods.ts (new; resolveDashboardPeriods stays until Task 6 removes its last caller; buildSevenDayChart unchanged)
  export function inSaigonDayRange(createdAtIso: string, range: DateRange): boolean;
  export function dashboardQueryStart(ranges: DateRange[], now: Date): Date; // earliest of the ranges' Saigon starts and the 7-day chart start
  // sales-totals.ts
  export interface SalesTotals { totalRevenue: number; totalOrders: number; avgOrderValue: number }
  export function computeSalesTotals(orders: Array<{ id: string; net_total: number }>, categoryLines: Array<{ order_id: string; net_line_total: number }> | null): SalesTotals;
  // actions.ts
  export async function getSalesTotalsV2(filters: PnLReportFilters): Promise<SalesTotals>; // requireAdmin; same order filter as getSalesDataV2; reads lines only when categoryId is set
  ```

- [ ] **Step 1 (Opus): failing tests.**

```ts
// lib/reports/dashboard-periods.test.ts -- new cases added; the resolveDashboardPeriods cases stay until Task 6
// deletes the function (its Saigon-day edges are re-pinned here first); buildSevenDayChart cases unchanged.
import { dashboardQueryStart, inSaigonDayRange } from "./dashboard-periods";

describe("inSaigonDayRange", () => {
  const oct = { start: "2026-10-01", end: "2026-10-31" };
  it("06:10 on 01/10 Saigon (23:10 UTC on 30/09) is in October", () => {
    expect(inSaigonDayRange("2026-09-30T23:10:00Z", oct)).toBe(true);
  });
  it("23:00 on 30/09 Saigon (16:00 UTC) is not", () => {
    expect(inSaigonDayRange("2026-09-30T16:00:00Z", oct)).toBe(false);
  });
  it("23:59 on 31/10 Saigon is in, 00:00 on 01/11 Saigon is out", () => {
    expect(inSaigonDayRange("2026-10-31T16:59:00Z", oct)).toBe(true);
    expect(inSaigonDayRange("2026-10-31T17:00:00Z", oct)).toBe(false);
  });
});

describe("dashboardQueryStart", () => {
  it("reaches back to the earliest compare start in Saigon", () => {
    const now = new Date("2026-10-09T09:00:00Z");
    expect(dashboardQueryStart([{ start: "2026-10-01", end: "2026-10-09" }, { start: "2026-09-01", end: "2026-09-09" }], now).toISOString())
      .toBe("2026-08-31T17:00:00.000Z");
  });
  it("never later than the 7-day chart's first day", () => {
    const now = new Date("2026-10-09T09:00:00Z");
    expect(dashboardQueryStart([{ start: "2026-10-09", end: "2026-10-09" }], now).toISOString()).toBe("2026-10-02T17:00:00.000Z");
  });
});
```

```ts
// lib/reports/sales-totals.test.ts
import { describe, expect, it } from "vitest";
import { computeSalesTotals } from "./sales-totals";

describe("computeSalesTotals -- the three cards of Doanh số", () => {
  const orders = [{ id: "A", net_total: 50000 }, { id: "B", net_total: 30000 }, { id: "C", net_total: 20000 }];
  it("without a category: every order", () => {
    expect(computeSalesTotals(orders, null)).toEqual({ totalRevenue: 100000, totalOrders: 3, avgOrderValue: 100000 / 3 });
  });
  it("with a category: only its lines, orders counted once", () => {
    const lines = [{ order_id: "A", net_line_total: 25000 }, { order_id: "A", net_line_total: 10000 }, { order_id: "C", net_line_total: 20000 }];
    expect(computeSalesTotals(orders, lines)).toEqual({ totalRevenue: 55000, totalOrders: 2, avgOrderValue: 27500 });
  });
  it("no orders: zeros, no division by zero", () => {
    expect(computeSalesTotals([], null)).toEqual({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
  });
});
```
  Plus in `app/admin/reports/actions.test.ts`: `getSalesTotalsV2` refuses a non-admin like its siblings, and for the same mocked orders returns the same three numbers as `getSalesDataV2`'s `totalRevenue`, `totalOrders`, `avgOrderValue` (with and without `categoryId`).
  Run `npx vitest run lib/reports app/admin/reports/actions.test.ts`. Expected: FAIL, missing exports.
- [ ] **Step 2 (Sonnet): implement.** `getSalesDataV2` computes its three totals through `computeSalesTotals` (no change in value; `getSalesDataV2` existing tests stay green untouched). `getSalesTotalsV2` reuses `findCompletedOrders` and the same superseded/date/brand/staff filter (extract it into one local function both call), reads `Order_Lines_V2` only when `categoryId` is set and filters them by `product_snapshot_json.category_id` exactly as `getSalesDataV2` does. Leave `resolveDashboardPeriods` and its tests untouched: `app/admin/page.tsx` still calls it until Task 6.
- [ ] **Step 3: run** `npx vitest run lib/reports app/admin/reports`, tsc. Expected: PASS.
- [ ] **Step 4: commit** `feat(lib): figures for the compare period — whole Saigon days for Tổng quan, one totals function for Doanh số's three cards (BR-UI-007)`.

### Task 6: Tổng quan, Doanh số so với kỳ trước; bỏ Tổng kết ngày (Gemini + Opus)

**Files:** `app/admin/page.tsx`, `app/admin/page.test.tsx`, `app/admin/reports/sales/page.tsx`, `app/admin/reports/components/SalesFilter.tsx`, a new `app/admin/reports/components/CompareLine.tsx` shared by both pages; Opus: delete `app/admin/reports/daily/` and `lib/reports/daily-digest.ts` + tests, edit `app/admin/nav-items.ts` + test, `next.config.js`, remove `resolveDashboardPeriods` and its test cases (replaced by the `inSaigonDayRange` cases of Task 5).

**Interfaces:**
- Consumes: `readRangeParams`, `comparePeriods`, `compareLabel`, `percentChange`, `inSaigonDayRange`, `dashboardQueryStart`, `getSalesTotalsV2`, `DateRangeButton`.
- Produces: `CompareLine({ change: number | null; label: string })` → "▲ 12.5% so với 01/09 – 09/09", "▼ 3.1% so với thứ Sáu 02/10", "− 0.0% …" when equal, "Kỳ trước chưa có số" when `change` is null.

- [ ] **Step 1 (Opus): failing tests.**
  - `app/admin/page.test.tsx` (existing clock tests kept): `findAllWhere` mocked with orders on 09/10 (2 orders, 100,000 + 50,000), 08/10 (1 order, 120,000), 02/10 (none), clock `2026-10-09T09:00:00Z`, `searchParams { range: "TODAY" }` → text contains "Hôm nay · 09/10/2026", "150,000", "▲ 25.0%", "so với hôm qua", "Kỳ trước chưa có số", "so với thứ Sáu 02/10". `searchParams {}` → "Tháng này · 01/10/2026 – 31/10/2026" and "so với 01/09 – 09/09". No text "Tất cả". Clock `2026-09-30T23:30:00Z` (06:30 on 01/10 Saigon), `{}` → "Tháng này · 01/10/2026 – 31/10/2026".
  - Sales page test (new `app/admin/reports/sales/page.test.tsx`, actions mocked): `{}` → `getSalesDataV2` called with `startDate "2026-10-01"`, `endDate "2026-10-31"`; `getSalesTotalsV2` called once with `2026-09-01`..`2026-09-09` and the same `brandId`; `{ range: "TODAY", brandId: "B1" }` → `getSalesTotalsV2` called twice (08/10 and 02/10) with `brandId "B1"`; the page shows "so với hôm qua".
  - `CompareLine.test.tsx`: the four outputs above.
  - `app/admin/nav-items.test.ts`: "Tổng kết ngày" removed from the expected menu (edit the expectation first so it fails against today's menu).
  - A config test (`tests/next-config-redirects.test.ts`): `require("../next.config.js").redirects()` contains `{ source: "/admin/reports/daily", destination: "/admin/reports/sales?range=TODAY", permanent: false }`.
  Run. Expected: FAIL.
- [ ] **Step 2 (Gemini): brief.** Tổng quan: read the range, `comparePeriods`, fetch from `dashboardQueryStart`, count current and each compare period with `inSaigonDayRange`, five cards each with one `CompareLine` per period (card "Nhà cung cấp" none); `DateRangeButton` replaces the eight links; drop `TrendBadge`; "Top 5" and the 7-day chart unchanged. Doanh số: range from params (default Tháng này), compares via `getSalesTotalsV2` with the same brand/staff/category, `CompareLine` under the three cards; `SalesFilter` loses the three day buttons and two date boxes, gets `DateRangeButton` (applies at once, keeps brand/staff/category in the address), "Lọc" keeps `range/from/to`. Both layouts.
- [ ] **Step 3 (Opus):** delete Tổng kết ngày files (`app/admin/reports/daily/` six files, `lib/reports/daily-digest.ts` + test), menu line, `redirects()` in `next.config.js`, remove `resolveDashboardPeriods`; docs: `docs/03-workflows/reports.md` (routes line, lines 18, 50), `data-integrity.md` line 67 (the daily report's percentage goes; Doanh số's compare joins the list), `docs/superpowers/specs/2026-09-29-menu-va-khuon-trang-design.md` line 89.
- [ ] **Step 4: verify** `npx vitest run app/admin lib/reports tests`, tsc, the two docs gates; `grep -rn "reports/daily\|daily-digest\|resolveDashboardPeriods" app lib components docs --include=*.ts --include=*.tsx --include=*.md` shows only dated history in plans.
- [ ] **Step 5: commit(s)** `feat(ui): Tổng quan and Doanh số take the shared filter and compare with the period before; Tổng kết ngày goes, its address opens Doanh số on Hôm nay (BR-UI-007)`; message names the removed tests and why.

### Task 7: Lãi lỗ theo khoảng tháng — phần tính (Sonnet)

**Files:** `lib/reports/profit-and-loss.ts`, `lib/reports/profit-and-loss-table.ts`, `app/admin/reports/pnl/actions.ts`, their tests; `scripts/verify-pnl-monthly.ts` (it calls `getProfitAndLossReport(year)`).

**Interfaces:**
- Consumes: `RangeValue` in month mode (Task 1).
- Produces:
  ```ts
  // PnlInput: `year: number` replaced by
  fromMonth: string; toMonth: string; // "YYYY-MM"
  // PnlFigures and PnlTable: `year` replaced by fromMonth, toMonth; PnlTable.periodLabel replaced by
  rangeName: string; // "năm nay", "quý trước", "trong khoảng đã chọn" ... (lower-case preset label; CUSTOM → "trong khoảng đã chọn")
  export function buildPnlTable(figures: PnlFigures, today: string, rangeName: string): PnlTable;
  export async function getProfitAndLossReport(range: RangeValue): Promise<{ figures: PnlFigures; table: PnlTable; brandNames: string[]; availableYears: number[] }>;
  // the result keeps availableYears (unused by the page; scripts/verify-pnl-monthly.ts loops on it)
  ```

- [ ] **Step 1 (Opus): failing tests.** In `profit-and-loss.test.ts` convert the helper: `input({ year: 2026 })` becomes `input({ fromMonth: "2026-01", toMonth: "2026-12" })` (mechanical; commit says so). New cases: `fromMonth "2025-11", toMonth "2026-02"`, today `2026-10-09`, an asset depreciating from 2025-11 → months `["2025-11","2025-12","2026-01","2026-02"]`; `fromMonth "2026-09", toMonth "2026-12"` → months stop at `2026-10`; `fromMonth "2026-11", toMonth "2026-12"` → `[]`. In `profit-and-loss-table.test.ts`: `rangeName` passes through; a span 2025-11..2026-02 gives month titles "11/2025" … "02/2026". In `pnl/actions` test (create if missing, mocking `findAllWhere`/`findAllNoCache`): orders are read from the Saigon start of `fromMonth` to the Saigon end of `toMonth` (`2025-10-31T17:00:00.000Z` … `2026-02-28T16:59:59.999Z`). `listAvailableYears` cases unchanged. Run. Expected: FAIL.
- [ ] **Step 2 (Sonnet): implement.** `candidateMonths(fromMonth, toMonth, today)` = every month from `fromMonth` to the earlier of `toMonth` and the current month; leading empty months still trimmed (step 6 unchanged); expense-group rule "in use or with a figure" reads "in the range". `getProfitAndLossReport` reads orders for the span, still returns `availableYears`; `buildPnlTable` takes `rangeName`. `scripts/verify-pnl-monthly.ts`: per year call `getProfitAndLossReport({ preset: "CUSTOM", start: `${year}-01`, end: `${year}-12` })`, nothing else changes.
- [ ] **Step 3: run** `npx vitest run lib/reports app/admin/reports/pnl`, tsc; `npx vite-node scripts/verify-pnl-monthly.ts` read-only, expect 0 differences over the months it checks (report the count). Expected: PASS.
- [ ] **Step 4: commit** `feat(lib): Lãi lỗ computes any span of whole months, across a year if asked (BR-UI-007)`.

### Task 8: Lãi lỗ — màn hình (Gemini)

**Files:** `app/admin/reports/pnl/page.tsx`, `components/{PnlSummary,PnlMonthCards,PnlChart,PnlTableView}.tsx` and tests; delete `components/YearSelect.tsx`.

- [ ] **Step 1 (Opus): failing tests.** Page test: `searchParams {}` → `getProfitAndLossReport` called with `{ preset: "THIS_YEAR", start: "2026-01", end: "2026-10" }`; `{ year: "2025" }` → `CUSTOM 2025-01..2025-12`; the button reads "Năm nay · 01/2026 – 10/2026"; empty figures → "Từ 07/2025 đến 06/2026 chưa có số liệu nào." for `CUSTOM 2025-07..2026-06`. `PnlSummary`: tile label "Doanh thu năm nay"; `PnlMonthCards` eyebrow from `rangeName`; `PnlChart` aria-label names the span, not a year; `PnlTableView` with 24 months renders 24 month headers plus Tổng on a computer and 24 cards on a phone. Run. Expected: FAIL.
- [ ] **Step 2 (Gemini): brief.** `DateRangeButton mode="month"` replaces `YearSelect` in the header; page reads `readMonthRangeParams`; on change `router.push` with `writeRangeParams`; components use `fromMonth`/`toMonth`/`rangeName`; wide tables scroll inside their card on a computer; phone cards unchanged in shape. Delete `YearSelect.tsx`.
- [ ] **Step 3 (Opus): verify** `npx vitest run app/admin/reports/pnl lib/reports`, tsc, read the diff.
- [ ] **Step 4: commit** `feat(ui): Lãi lỗ takes the shared filter in whole months, opening on Năm nay (BR-UI-007)`.

### Task 9: Tài liệu, năm lệnh kiểm, soát (Opus)

- [ ] `BR-UI-007` status line in `screens.md`: built on the branch with the date; spec status line; master plan 1b line; `docs/03-workflows/reports.md` describes the shared filter and compare.
- [ ] Five gates; build in a throwaway worktree (`../bwt22`, removed after); `git worktree list` and the Desktop checked clean.
- [ ] Fresh reviewer on the most capable model with the Review Focus verbatim and the ledger's rulings; one fix pass.
- [ ] Owner check list (held until push): Tổng quan Tháng này shows "6,563,000"-and-up with "▲ … so với 01/09 – 09/09"; Hôm nay shows two compare lines; Phiếu xuất opens on Tháng này, typing `ISL-00053` finds the September slip; Sổ thu chi day row opens Đơn hàng on that day; Lãi lỗ opens Năm nay, Quý trước works; old daily-report shortcut lands on Doanh số Hôm nay; phone: the nine buttons fit one screen.
