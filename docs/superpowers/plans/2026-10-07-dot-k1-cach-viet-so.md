# Đợt K1 — cách viết số mới trên toàn hệ thống (BR-UI-008)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Who does which task is fixed by `CLAUDE.md` ("Ai viết code"): `lib/` and its tests → Sonnet; screens (`.tsx` under `app/`, `components/`) → Gemini via `agy`; guard test, UI test expectations, docs, review → Opus.

**Goal:** Every number on every screen, the POS included, is written with a comma between thousands and a dot before decimals (1,250.5), and every hand-typed number box accepts a dot, not a comma, for decimals.

**Architecture:** One shared formatter in `lib/shared/format.ts` (`formatNumber`, new `formatDecimal`) becomes the only place that turns a number into text; the 17 files that format numbers themselves are routed through it, and a guard test keeps it that way. The digit helpers in `lib/shared/money-digits.ts` switch their thousands mark to a comma and gain three helpers for decimal text, used now by the issue-slip quantity boxes and in wave K2 by the shared `NumberInput`. The server's money parser `parseAmountVn` flips with them.

**Tech Stack:** TypeScript, Next.js App Router, React, Vitest, `Intl.NumberFormat`.

**Spec:** `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (sections 2.2, 2.7, 3, 4 row K1, 5, 6). Rule: `BR-UI-008` in `docs/02-rules/business-rules/screens.md`.

Kế hoạch này xoá khi chủ quán nhận đợt K1.

## Hiện trạng

1. **Trạng thái.** Không áp dụng, vì đợt này không thêm bảng hay trạng thái nào; chỉ đổi cách số hiện ra và cách ô nhận dấu.
2. **Nút.** Không áp dụng, vì không nút nào đổi.
3. **Danh sách.** Không danh sách nào đổi nội dung. Chỉ chữ số trong ô đổi dấu: `1.250.000` thành `1,250,000`.
4. **Ô nhập.**
   - Ô Số lượng ở trang tạo phiếu xuất (`IssueSlipClient.tsx`, máy tính và điện thoại) và trang sửa phiếu xuất (`IssueSlipDetailClient.tsx`) hôm nay chỉ giữ chữ số và dấu phẩy, đọc dấu phẩy là phần lẻ, bỏ dấu chấm: gõ `1.5` thành 15. Sau đợt này: giữ chữ số và một dấu chấm, tối đa 3 chữ số lẻ, bỏ dấu phẩy; gõ thêm chữ số lẻ thứ tư thì phím bị bỏ. Chưa chèn dấu phẩy hàng nghìn trong ô và chưa có ví dụ mờ: hai việc đó đến cùng `NumberInput` ở đợt K2, vì chèn dấu cần giữ chỗ con trỏ.
   - Ô tiền `MoneyInput` (Sổ thu chi, Chuyển tiền) hôm nay tự chèn dấu chấm; sau đợt này tự chèn dấu phẩy (`150,000`), vẫn bỏ mọi dấu gõ vào.
   - Máy chủ, `parseAmountVn`: hôm nay nhận `150000` và `150.000`; sau đợt này nhận `150000` và `150,000`, từ chối `150.000` với câu "Số tiền chỉ gồm chữ số; dấu phẩy chỉ dùng để chia hàng nghìn (ví dụ 150,000)".
   - Các ô `type="number"` không đổi ở đợt này: trình duyệt đã gửi số dạng `1250.5`.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ mọi con số hiện trên màn quản trị, báo cáo, biểu đồ và máy bán hàng. Cố ý không đổi: ngày tháng (`BR-DATA-006`), số đã lưu, cách tính, số lẻ của phần trăm (giữ như hôm nay; mục "chưa theo luật" của `BR-DATA-005` vẫn mở), chữ in ra của `scripts/` (chỉ Opus đọc), và các con số viết trong tài liệu luật cũ.

Câu hỏi riêng của việc này:

6. **Đổi một lần hay dần dần?** Một lần, trong một lần đẩy: nếu bảng đã viết `1,250` mà ô phiếu xuất vẫn hiểu dấu phẩy là phần lẻ, cùng một màn sẽ có hai nghĩa. Vì vậy ô phiếu xuất và `parseAmountVn` đổi trong cùng đợt.
7. **Máy bán hàng có ngừng nhận đơn không?** Không. Máy bán hàng chỉ đọc `formatNumber` để hiện giá; không ô nào của máy bán hàng nhận số có dấu. Đợt này không đụng hàng đợi ngoại tuyến hay thanh toán. Báo chủ quán trước khi đẩy để dặn nhân viên: giá hiện `25,000` thay cho `25.000`.
8. **Biểu đồ đang ghi "M" (triệu, tiếng Anh).** `CategoryPieChart.tsx` và trang Doanh số ghi `1.5M`. Theo `BR-DATA-005` biểu đồ dùng "tr", theo `BR-UI-001` chữ phải tiếng Việt; vì phải chuyển hai chỗ này qua hàm chung, dùng luôn `formatCompact(..., "tr")`: hiện `1.5tr`.

Ví dụ (chỉ đổi cách hiện, không đổi số; hai giá trị xuất lấy từ trang mẫu chủ quán duyệt 2026-10-07, đợt này không tính gì mới nên không cần đo lại):

| Chỗ | Hôm nay | Sau K1 |
|---|---|---|
| Giá trị xuất 1000 ml Sữa tươi Mlekovita | `27.100đ` | `27,100đ` |
| Giá trị xuất 500 g Bột cà phê MR.PHIN Robusta Dak Mil | `122.299đ` | `122,299đ` |
| Ô Số lượng phiếu xuất, gõ `1.5` (hộp 1000 g) | 15 hộp = 15,000 g | 1.5 hộp = 1,500 g |
| Ô tiền Sổ thu chi, gõ `150000` | `150.000` | `150,000` |
| Biểu đồ Lãi lỗ, 100.120 đồng | `100,12k` | `100.12k` |

Đã xem: `lib/shared/format.ts`, `lib/shared/money-digits.ts`, `lib/finance/cash-entry-rules.ts`, `lib/reports/compact-money.ts`, `lib/reports/display-rounding.ts`, `lib/stock/issue-slip-onhand-display.ts`, `lib/stock/item-stock-display.ts`, `components/ui/MoneyInput.tsx` (dòng 80–135), `app/admin/no-popups.test.ts`, chỗ đọc số lượng trong `IssueSlipClient.tsx` (dòng 50–60, 100–110, 175–185, 295–310, 455–470) và `IssueSlipDetailClient.tsx` (dòng 30–42, 170–195), danh sách 17 file tự định dạng số (grep 2026-10-07). Chưa xem: phần còn lại của các file báo cáo `.tsx` ngoài các dòng grep chỉ ra; từng file test sẽ đỏ vì chữ số kiểu cũ (grep thô 2026-10-07: tới 117 file có chuỗi giống số kiểu cũ, nhiều chuỗi là mã hay ngày, chỉ chạy bộ test mới biết số thật).

## Global Constraints

- Thousands mark: comma `,`. Decimal mark: dot `.`. No other style anywhere on screen (`BR-UI-008`).
- `lib/shared/format.ts` is the only file in `app`, `components`, `lib` (tests excluded) allowed to call `toLocaleString(`, `Intl.NumberFormat`, or `.toFixed(` — `Intl.DateTimeFormat` and `toLocaleDateString`/`toLocaleTimeString` are dates and stay allowed.
- Money is whole đồng: a money box drops both `.` and `,` (`BR-CASH-005`).
- Number box (issue slip, this wave): digits and one dot; at most 3 decimals; integer part at most 15 digits; a keystroke that would break either limit is rejected whole (box keeps its previous text), never truncated.
- No server action changes except `parseAmountVn`.
- Code and comments in English; on-screen text in Vietnamese.
- Do not touch `public/pos-sw.js`, `lib/pos/pos-offline-queue.ts`, `lib/pos/pos-checkout-idempotency.ts`.
- Every new test is run red on the code before the change first; say whether red is a missing function or a wrong value.
- Never delete a test; when an expected string changes from `15.000` to `15,000`, change only that string.

## Review Focus

1. A pasted `1,250.5` into the issue-slip quantity box must read 1250.5, not 1.2505 or 12505 — pinned in Task 2 (`normalizeNumberText`).
2. `.5` typed alone must read 0.5, and `0` then `.` must stay `0.` while typing, not vanish — pinned in Task 2.
3. A saved issue slip opened for editing must show its quantity `1.5` (dot), not `1,5`, or the box would now read it as 15 — pinned in Task 5 by the `formatInputQuantity` change and its test.
4. The money box must never let a dot through as a decimal: typing `150.5` gives `1,505`, which the owner sees before saving — pinned in Task 2's MoneyInput expectation update (Task 7).
5. Negative values on screen (P&L losses) keep their minus sign with the new marks: `-1,250,000`, and `-0` never shows — pinned in Task 1.

---

### Task 1: Shared formatter writes the new style (Sonnet)

**Files:**
- Modify: `lib/shared/format.ts`
- Create: `lib/shared/format.test.ts`

**Interfaces:**
- Produces:
  - `formatNumber(value: number | string | null | undefined, opts?: { withDecimals?: boolean }): string` — unchanged signature; `15000` → `"15,000"`; `withDecimals` → exactly 2 decimals, `"1,250.50"`; null/undefined/NaN/±Infinity → `"---"`.
  - `formatDecimal(value: number, opts: { maxDigits: number; minDigits?: number }): string` — `formatDecimal(20.625, { maxDigits: 2 })` → `"20.63"`; `formatDecimal(20.6, { maxDigits: 2 })` → `"20.6"`; `formatDecimal(45.3, { minDigits: 1, maxDigits: 1 })` → `"45.3"`; `formatDecimal(1250000.5, { maxDigits: 3 })` → `"1,250,000.5"`.

- [ ] **Step 1: Write the failing test** — `lib/shared/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDecimal, formatNumber } from "./format";

// BR-UI-008 (owner 2026-10-07): comma between thousands, dot before decimals.
describe("formatNumber", () => {
  it("groups thousands with a comma", () => {
    expect(formatNumber(15000)).toBe("15,000");
    expect(formatNumber(1250000)).toBe("1,250,000");
    expect(formatNumber("27100")).toBe("27,100");
  });
  it("rounds to a whole number by default", () => {
    expect(formatNumber(27099.9)).toBe("27,100");
  });
  it("shows exactly two decimals with a dot when asked", () => {
    expect(formatNumber(1250.5, { withDecimals: true })).toBe("1,250.50");
  });
  it("keeps the minus sign", () => {
    expect(formatNumber(-1250000)).toBe("-1,250,000");
  });
  it("shows --- for missing or non-finite values", () => {
    expect(formatNumber(null)).toBe("---");
    expect(formatNumber(undefined)).toBe("---");
    expect(formatNumber(Number.NaN)).toBe("---");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("---");
  });
});

describe("formatDecimal", () => {
  it("keeps up to maxDigits decimals and trims trailing zeros", () => {
    expect(formatDecimal(20.625, { maxDigits: 2 })).toBe("20.63");
    expect(formatDecimal(20.6, { maxDigits: 2 })).toBe("20.6");
    expect(formatDecimal(20, { maxDigits: 2 })).toBe("20");
  });
  it("pads to minDigits", () => {
    expect(formatDecimal(45, { minDigits: 1, maxDigits: 1 })).toBe("45.0");
    expect(formatDecimal(45.34, { minDigits: 1, maxDigits: 1 })).toBe("45.3");
  });
  it("groups thousands", () => {
    expect(formatDecimal(1250000.5, { maxDigits: 3 })).toBe("1,250,000.5");
  });
  it("keeps the minus sign", () => {
    expect(formatDecimal(-100.12, { maxDigits: 2 })).toBe("-100.12");
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx vitest run lib/shared/format.test.ts`
Expected: FAIL — `formatDecimal` is not exported (missing function), and `formatNumber(15000)` returns `"15.000"` (wrong value). Report both.

- [ ] **Step 3: Implement** — replace the body of `lib/shared/format.ts` with:

```ts
/**
 * The one place that turns a number into on-screen text (BR-UI-008, owner
 * 2026-10-07): a comma between thousands, a dot before decimals, on every
 * screen including the POS. A guard test (lib/shared/format.guard.test.ts)
 * fails when any other file formats a number itself.
 *
 * Earlier history: 2026-07-06 the owner asked for plain numbers with no
 * currency suffix; context (đồng vs quantity) comes from the labels around.
 */

const NUMBER_LOCALE = "en-US";

const NUMBER_FORMATTER = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER_DECIMAL = new Intl.NumberFormat(NUMBER_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Whole number with comma thousands: 15000 -> "15,000".
 * withDecimals: exactly two decimals, "1,250.50".
 * "---" for null/undefined/NaN/Infinity (defensive).
 */
export function formatNumber(
  value: number | string | null | undefined,
  opts: { withDecimals?: boolean } = {}
): string {
  const { withDecimals = false } = opts;
  if (value === null || value === undefined) return "---";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "---";
  return withDecimals
    ? NUMBER_FORMATTER_DECIMAL.format(num)
    : NUMBER_FORMATTER.format(num);
}

const decimalFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A number with up to maxDigits decimals (trailing zeros trimmed down to
 * minDigits): formatDecimal(20.625, { maxDigits: 2 }) -> "20.63".
 */
export function formatDecimal(
  value: number,
  opts: { maxDigits: number; minDigits?: number }
): string {
  const minDigits = opts.minDigits ?? 0;
  const key = `${minDigits}:${opts.maxDigits}`;
  let formatter = decimalFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(NUMBER_LOCALE, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: opts.maxDigits,
    });
    decimalFormatters.set(key, formatter);
  }
  return formatter.format(value);
}
```

- [ ] **Step 4: Run it green**

Run: `npx vitest run lib/shared/format.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit** (do not run the full suite yet; many screen tests still expect the old marks and are fixed in Task 7)

```bash
git add lib/shared/format.ts lib/shared/format.test.ts
git commit -m "feat(format): numbers on screen use a comma for thousands and a dot for decimals; formatDecimal for figures with decimals (BR-UI-008)"
```

---

### Task 2: Digit helpers — comma grouping and decimal text (Sonnet)

**Files:**
- Modify: `lib/shared/money-digits.ts`
- Modify: `lib/shared/money-digits.test.ts`

**Interfaces:**
- Produces (later used by Task 5 and by `NumberInput` in wave K2):
  - `groupThousands(digits: string): string` — now `"1000"` → `"1,000"`.
  - `caretAfterFormat(charsLeftOfCaret: number, formatted: string): number` — now counts digits **and** dots, so it works for `"1,250.5"`; money strings contain no dot, so `MoneyInput` behaves as before.
  - `normalizeNumberText(raw: string, decimals: number): string | null` — typed or pasted text → canonical text (digits, at most one dot, no commas). `null` means "reject this keystroke": more than `decimals` decimals, or more than 15 integer digits.
  - `groupNumberText(text: string): string` — canonical text → shown text: `"1250.5"` → `"1,250.5"`, `"1250."` → `"1,250."`.
  - `numberTextToValue(text: string): number | null` — canonical text → number; `""` → `null`; `"5."` → `5`.
  - `removeDigitAcrossDot` keeps its name and behaviour (it works on digit strings, so it now steps over a comma); update its comment to say "thousands mark".

- [ ] **Step 1: Write the failing tests** — in `lib/shared/money-digits.test.ts`, change the existing `groupThousands` expectations from dots to commas (`"1.000"` → `"1,000"`, `"100.000.000.000.000"` → `"100,000,000,000,000"`, `"1.500"` → `"1,500"`, `"15.000"` → `"15,000"`) and every `caretAfterFormat` call whose formatted string contains a dot as thousands mark to the comma form. Then append:

```ts
import { groupNumberText, normalizeNumberText, numberTextToValue } from "./money-digits";

// BR-UI-008 (owner 2026-10-07): the dot is the only mark typed, for
// decimals; a comma is the thousands mark and is never accepted as typed.
describe("normalizeNumberText", () => {
  it("keeps digits and one dot", () => {
    expect(normalizeNumberText("1250.5", 3)).toBe("1250.5");
  });
  it("drops commas, so a pasted grouped number reads right", () => {
    expect(normalizeNumberText("1,250.5", 3)).toBe("1250.5");
    expect(normalizeNumberText("1,250.5abc", 3)).toBe("1250.5");
  });
  it("drops a second dot", () => {
    expect(normalizeNumberText("1.2.5", 3)).toBe("1.25");
  });
  it("reads a leading dot as 0.", () => {
    expect(normalizeNumberText(".5", 3)).toBe("0.5");
    expect(normalizeNumberText(".", 3)).toBe("0.");
  });
  it("keeps a lone zero and 0. while typing, strips other leading zeros", () => {
    expect(normalizeNumberText("0", 3)).toBe("0");
    expect(normalizeNumberText("0.", 3)).toBe("0.");
    expect(normalizeNumberText("007", 3)).toBe("7");
    expect(normalizeNumberText("00.5", 3)).toBe("0.5");
  });
  it("rejects a fourth decimal when three are allowed", () => {
    expect(normalizeNumberText("1.2345", 3)).toBeNull();
  });
  it("drops every dot when no decimals are allowed", () => {
    expect(normalizeNumberText("150.5", 0)).toBe("1505");
  });
  it("rejects a 16th integer digit", () => {
    expect(normalizeNumberText("1234567890123456", 3)).toBeNull();
    expect(normalizeNumberText("123456789012345", 3)).toBe("123456789012345");
  });
  it("returns empty for empty or mark-only input", () => {
    expect(normalizeNumberText("", 3)).toBe("");
    expect(normalizeNumberText(",", 3)).toBe("");
  });
});

describe("groupNumberText", () => {
  it("puts commas in the whole part and keeps the decimals as typed", () => {
    expect(groupNumberText("1250.5")).toBe("1,250.5");
    expect(groupNumberText("1250.")).toBe("1,250.");
    expect(groupNumberText("1250000")).toBe("1,250,000");
    expect(groupNumberText("0.500")).toBe("0.500");
    expect(groupNumberText("")).toBe("");
  });
});

describe("numberTextToValue", () => {
  it("reads canonical text", () => {
    expect(numberTextToValue("1250.5")).toBe(1250.5);
    expect(numberTextToValue("5.")).toBe(5);
    expect(numberTextToValue("0.")).toBe(0);
  });
  it("is null when empty", () => {
    expect(numberTextToValue("")).toBeNull();
  });
});

describe("caretAfterFormat with decimals", () => {
  it("counts the dot as a character the caret can sit after", () => {
    // "1250.5" with the caret after "1250." (5 chars) -> after "1,250." (6)
    expect(caretAfterFormat(5, "1,250.5")).toBe(6);
  });
});
```

- [ ] **Step 2: Run it red**

Run: `npx vitest run lib/shared/money-digits.test.ts`
Expected: FAIL — the three new functions are not exported (missing function); `groupThousands("1000")` returns `"1.000"` (wrong value).

- [ ] **Step 3: Implement** — in `lib/shared/money-digits.ts`:

Change the `groupThousands` comment to "Comma every 3 digits from the right (BR-UI-008)" and its last line to:

```ts
  return groups.join(",");
```

Change `caretAfterFormat` to count digits and dots:

```ts
// Where to put the caret in `formatted` so it sits right after the same
// count of digits and dots that were to its left before formatting --
// inserting or removing a comma must not throw the caret to the end of the
// field. Money text has no dot, so for money this counts digits only.
export function caretAfterFormat(charsLeftOfCaret: number, formatted: string): number {
  if (charsLeftOfCaret <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted[i];
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      seen++;
      if (seen === charsLeftOfCaret) return i + 1;
    }
  }
  return formatted.length;
}
```

Append:

```ts
const MAX_INTEGER_DIGITS = 15;

// Typed or pasted text -> canonical number text: digits, at most one dot,
// no commas (BR-UI-008: the comma is the thousands mark and is never typed).
// null = reject the keystroke whole (too many decimals, or a 16th integer
// digit) -- never cut it down, which would silently keep another number.
export function normalizeNumberText(raw: string, decimals: number): string | null {
  const kept = raw.replace(decimals > 0 ? /[^0-9.]/g : /[^0-9]/g, "");
  const dot = kept.indexOf(".");
  const intRaw = dot < 0 ? kept : kept.slice(0, dot);
  const fraction = dot < 0 ? null : kept.slice(dot + 1).replace(/\./g, "");
  if (fraction !== null && fraction.length > decimals) return null;

  let intPart = intRaw.replace(/^0+(?=\d)/, "");
  if (intPart === "" && fraction !== null) intPart = "0";
  if (intPart.length > MAX_INTEGER_DIGITS) return null;
  return fraction === null ? intPart : `${intPart}.${fraction}`;
}

// Canonical text -> shown text: commas in the whole part, decimals as typed
// (a trailing dot stays while the user is still typing).
export function groupNumberText(text: string): string {
  if (!text) return "";
  const dot = text.indexOf(".");
  if (dot < 0) return groupThousands(text);
  return `${groupThousands(text.slice(0, dot))}.${text.slice(dot + 1)}`;
}

// Canonical text -> number; empty means nothing typed yet.
export function numberTextToValue(text: string): number | null {
  if (text === "") return null;
  const value = Number(text.endsWith(".") ? text.slice(0, -1) : text);
  return Number.isFinite(value) ? value : null;
}
```

Note `"007"`: `replace(/^0+(?=\d)/, "")` leaves `"7"`; `"0"` stays `"0"`; `"00.5"` → int `"0"` → `"0.5"`.

- [ ] **Step 4: Run green**

Run: `npx vitest run lib/shared/money-digits.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/money-digits.ts lib/shared/money-digits.test.ts
git commit -m "feat(money-digits): comma thousands mark; decimal number text helpers for hand-typed boxes (BR-UI-008)"
```

---

### Task 3: Server money parser flips (Sonnet)

**Files:**
- Modify: `lib/finance/cash-entry-rules.ts:23-60`
- Modify: `lib/finance/cash-entry-rules.test.ts:38-60`
- Modify: `lib/finance/cash-transfer-rules.test.ts:39-42`
- Modify: `docs/03-workflows/cash-book.md` (one dated "Reviewed" line; the flow-doc-staged gate requires it because `cash-entry-rules.ts` is a declared file)

**Interfaces:**
- Produces: `parseAmountVn(raw: string): ParseResult<number>` — same signature. Accepts `^\d+$` and `^\d{1,3}(,\d{3})+$` (spaces and NBSP removed first); everything else, `150.000` included, is `{ ok: false, error: AMOUNT_FORMAT_ERROR }`.

- [ ] **Step 1: Write the failing tests** — in `cash-entry-rules.test.ts`:

```ts
  const AMOUNT_FORMAT_ERROR =
    "Số tiền chỉ gồm chữ số; dấu phẩy chỉ dùng để chia hàng nghìn (ví dụ 150,000)";
  // BR-UI-008 (owner 2026-10-07): the dot now marks decimals, and money is
  // whole đồng, so "150.000" is refused instead of read as 150000.
  it.each(["1500.5", "150.000", "1e6", "0x10", "-5", "abc", "1,50,000", "-5000"])(
```

(keep the existing body of that `it.each`), and in the accepted list replace `["150.000", 150000], [" 150.000 ", 150000]` with `["150,000", 150000], [" 150,000 ", 150000], ["1,250,000", 1250000]`. In `cash-transfer-rules.test.ts` rename the test to `"accepts 150,000 as 150000"` and pass `amount: "150,000"`; add:

```ts
  it("refuses 150.000 (a dot marks decimals, BR-UI-008)", () => {
    const r = parseCashTransfer({ ...good, amount: "150.000" }, ACTIVE);
    expect(r.ok).toBe(false);
  });
```

- [ ] **Step 2: Run red**

Run: `npx vitest run lib/finance/cash-entry-rules.test.ts lib/finance/cash-transfer-rules.test.ts`
Expected: FAIL — `"150.000"` is accepted as 150000 and `"150,000"` refused (wrong values); the message text differs (wrong value).

- [ ] **Step 3: Implement** — in `cash-entry-rules.ts`:

```ts
const AMOUNT_FORMAT_ERROR =
  "Số tiền chỉ gồm chữ số; dấu phẩy chỉ dùng để chia hàng nghìn (ví dụ 150,000)";
```

Replace the I1 comment block above `parseAmountVn` with:

```ts
// Two shapes are legal: digits only, or comma-separated groups of exactly
// three digits (BR-UI-008, owner 2026-10-07: a comma separates thousands, a
// dot marks decimals). Money is whole đồng (BR-CASH-005), so a dot is a
// format error -- "150.000" is refused, never read as 150 or 150000. The
// money box posts plain digits; this is the server's backstop. Scientific
// or hex notation and malformed groupings like "1,50,000" are refused too.
```

and the grouped branch:

```ts
  } else if (/^\d{1,3}(,\d{3})+$/.test(noSpaces)) {
    digits = noSpaces.replace(/,/g, "");
```

In `docs/03-workflows/cash-book.md`, under the existing "Reviewed" lines near the top, add:

```markdown
**Reviewed — 2026-10-07 (`BR-UI-008`):** `parseAmountVn` in `lib/finance/cash-entry-rules.ts` now reads `150,000` (comma thousands) and refuses `150.000`, because a dot marks decimals and money is whole đồng. The amount box posts plain digits, so nothing a user types changes; only the server backstop's accepted shape and its message do.
```

- [ ] **Step 4: Run green**

Run: `npx vitest run lib/finance`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/cash-entry-rules.ts lib/finance/cash-entry-rules.test.ts lib/finance/cash-transfer-rules.test.ts docs/03-workflows/cash-book.md
git commit -m "fix(finance): the server reads 150,000 and refuses 150.000 now that a dot marks decimals (BR-UI-008)"
```

---

### Task 4: `lib` callers go through the shared formatter (Sonnet)

**Files:**
- Modify: `lib/reports/compact-money.ts:12,25-29`
- Modify: `lib/stock/issue-slip-onhand-display.ts:18,42`
- Modify: `lib/stock/item-stock-display.ts:9,47`
- Modify: `lib/purchasing/purchase-order-cancel.ts:21` and its use of `quantityFormat`
- Modify: `lib/reports/outlet-breakdown-table.ts:23-30`
- Modify: `lib/reports/profit-and-loss-table.ts:91-98`
- Modify: `lib/assets/asset-depreciation.ts:86-91,150,157`
- Modify: `lib/reports/display-rounding.ts:8` (comment only, so the guard does not match it)
- Modify: the `*.test.ts` beside each file, expected strings only

**Interfaces:**
- Consumes: `formatNumber`, `formatDecimal` from `@/lib/shared/format` (Task 1).
- Produces: unchanged exports; only the text they return changes marks.

- [ ] **Step 1: Change expected strings first (red)** — in each sibling test (`lib/reports/compact-money.test.ts`, `lib/stock/issue-slip-onhand-display.test.ts`, `lib/stock/item-stock-display.test.ts`, `lib/purchasing/purchase-order-cancel.test.ts`, `lib/reports/outlet-breakdown-table.test.ts`, `lib/reports/profit-and-loss-table.test.ts`, `lib/assets/asset-depreciation.test.ts`; skip any that does not exist), swap marks in expected display strings only: `"100,12k"` → `"100.12k"`, `"20,62"` → `"20.62"`, `"1.000"` → `"1,000"`, `"45,3%"` → `"45.3%"`, `"Từ 500.000đ trở lên"` → `"Từ 500,000đ trở lên"`. Do not change inputs, ids, or dates.

- [ ] **Step 2: Run red**

Run: `npx vitest run lib/reports lib/stock lib/purchasing lib/assets`
Expected: FAIL on the changed strings with old-mark output (wrong value). Tests that format through `formatNumber` may already pass after Task 1; note which.

- [ ] **Step 3: Implement**

`lib/reports/compact-money.ts` — delete `COMPACT_FORMATTER`, import `formatDecimal`, and:

```ts
export function formatCompact(value: number, unit: CompactUnit): string {
  const divisor = unit === "tr" ? MILLION : THOUSAND;
  const formatted = formatDecimal(value / divisor, { maxDigits: 2 });
  if (formatted === "0" || formatted === "-0") return "0";
  return `${formatted}${unit}`;
}
```

`lib/stock/issue-slip-onhand-display.ts` — delete `CONVERTED_QTY_FORMATTER`, import `formatDecimal`, use `formatDecimal(converted, { maxDigits: 2 })`; in its comments change the examples to the new marks ("20.6", "20.62", "1,000 Cai").

`lib/stock/item-stock-display.ts` — delete `figureFormat`, import `formatDecimal`, use `formatDecimal(onHand, { maxDigits: 2 })`; comment example `"42,000 ml"`.

`lib/purchasing/purchase-order-cancel.ts` — delete `quantityFormat`, import `formatDecimal`, replace each `quantityFormat.format(x)` with `formatDecimal(x, { maxDigits: 2 })`.

`lib/reports/outlet-breakdown-table.ts`:

```ts
export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${formatDecimal(value, { minDigits: 1, maxDigits: 1 })}%`;
}
```

`lib/reports/profit-and-loss-table.ts`:

```ts
export function formatPercent(value: number | null): string {
  return value === null
    ? "---"
    : `${formatDecimal(value, { minDigits: PERCENT_DECIMALS, maxDigits: PERCENT_DECIMALS })}%`;
}
```

(delete both `PERCENT_FORMATTER` constants).

`lib/assets/asset-depreciation.ts` — import `formatNumber`; replace each `x.toLocaleString("vi-VN")` with `formatNumber(x)`.

`lib/reports/display-rounding.ts:8` — reword the comment to "the same direction formatNumber uses in lib/shared/format.ts".

- [ ] **Step 4: Run green**

Run: `npx vitest run lib`
Expected: PASS for every file under `lib`. If a `lib` test outside these files fails on an old-mark string, fix that expected string the same way and list it in the commit message.

- [ ] **Step 5: Commit**

```bash
git add lib
git commit -m "refactor(lib): every lib figure goes through the shared formatter, so it follows BR-UI-008"
```

---

### Task 5: Screens — hand-typed quantity boxes and hand-formatted numbers (Gemini via `agy`)

Opus writes the brief from this task. Run `agy models` first; use the newest generation at `-high` (Pro if that generation has one). Command: `agy --model <name> --mode accept-edits -p "$(cat <brief>)"`. Brief opens with "IMPORTANT: this run has NO command tool…"; Gemini edits files only; Opus runs the tests.

**Files:**
- Modify: `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` (lines ~56, ~107, ~180, ~303, ~464)
- Modify: `app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx` (lines ~35-42, ~178, ~191)
- Modify: `app/admin/inventory/purchase-orders/[id]/cancel/components/CancelPurchaseOrderForm.tsx:84,108`
- Modify: `app/admin/inventory/purchase-orders/[id]/page.tsx:157`
- Modify: `app/admin/page.tsx:23,224`
- Modify: `app/admin/reports/components/CategoryPieChart.tsx:37,43`
- Modify: `app/admin/reports/components/ProductTable.tsx:44,83,86,128,133`
- Modify: `app/admin/reports/components/SalesCharts.tsx:77`
- Modify: `app/admin/reports/daily/page.tsx:12`
- Modify: `app/admin/reports/sales/page.tsx:344,422,451`

**Interfaces:**
- Consumes: `formatNumber`, `formatDecimal` (`@/lib/shared/format`); `normalizeNumberText`, `numberTextToValue` (`@/lib/shared/money-digits`); `formatCompact` (`@/lib/reports/compact-money`).

- [ ] **Step 1: Issue-slip quantity boxes.** In both files, the box keeps canonical text (digits and one dot, no commas). On change:

```tsx
onChange={e => {
  const next = normalizeNumberText(e.target.value, 3);
  if (next === null) return; // a 4th decimal or a 16th digit: keep what was there
  updateLine(index, { packageQty: next });
}}
```

(in `IssueSlipDetailClient.tsx`, the same inside `handleQtyChange`: `const next = normalizeNumberText(val, 3); if (next === null) return;` and use `next` where `raw` was). Every read of the typed quantity becomes `numberTextToValue(text) ?? 0` instead of `Number(text.replace(/[^0-9,]/g, "").replace(",", "."))`. `formatInputQuantity` in `IssueSlipDetailClient.tsx` becomes:

```ts
function formatInputQuantity(val: number): string {
  return String(Math.round(val * 1000) / 1000);
}
```

`inputMode="decimal"` stays. Placeholder stays `"0"` in this wave (the worked example comes with `NumberInput` in K2).

- [ ] **Step 2: Hand-formatted numbers.**
  - `Number(line.quantity).toLocaleString("vi-VN")` → `formatDecimal(Number(line.quantity), { maxDigits: 3 })` (CancelPurchaseOrderForm ×2, purchase-orders `[id]/page.tsx`).
  - `app/admin/page.tsx:23` → `{formatDecimal(Math.abs(value), { minDigits: 1, maxDigits: 1 })}%`; `:224` → `{formatNumber(Math.round(d.amount / 1000))}k`.
  - `CategoryPieChart.tsx:37` → `Tổng<br/>{formatCompact(total, "tr")}`; `:43` → `const percent = formatDecimal((d.amount / total) * 100, { minDigits: 1, maxDigits: 1 });`.
  - `ProductTable.tsx` → every `x.toLocaleString("vi-VN")` becomes `formatNumber(x)`.
  - `SalesCharts.tsx:77` → `{formatNumber(Math.round(d.amount / 1000))}k`.
  - `reports/daily/page.tsx:12` → `` return `${sign}${formatDecimal(pct, { minDigits: 1, maxDigits: 1 })}%`; ``
  - `reports/sales/page.tsx:344` → `` ? formatCompact(cell.revenue, "tr") `` (was `` `${(cell.revenue / 1000000).toFixed(1)}M` ``); `:422`, `:451` → `formatNumber(totalToppingQty)`.
- No layout, colour, or wording changes besides "M" → "tr" on those two charts.

- [ ] **Step 3: Opus checks** — `git diff --stat` touches only the files above; `npx tsc --noEmit` clean; `npx vitest run app/admin/inventory/issue-slips app/admin/reports app/admin/inventory/purchase-orders` and note failures that are only old-mark expected strings (fixed in Task 7).

- [ ] **Step 4: Opus adds the red-first test for Review Focus 3** in `app/admin/inventory/issue-slips/components/IssueSlipDetailClient.test.tsx`: render a slip whose line quantity is 1.5 and assert the quantity box value is `"1.5"`. Prove it red by swapping in the HEAD version of `IssueSlipDetailClient.tsx` (value `"1,5"`, wrong value), restore, green. Add to `IssueSlipClient.test.tsx`: typing `1.5` into Số lượng with a 1000 g unit shows Quy ra `1,500 g` (red on HEAD: shows `15,000 g`, wrong value).

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "feat(ui): the issue-slip quantity box takes a dot for decimals; hand-formatted figures go through the shared formatter (BR-UI-008)"
```

---

### Task 6: Guard test — nobody formats numbers by hand (Opus)

**Files:**
- Create: `lib/shared/format.guard.test.ts`

- [ ] **Step 1: Write the guard**

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-008 (owner 2026-10-07): every number on screen is written by
// lib/shared/format.ts, so the style is set in one place and binds every
// new feature. Dates are not numbers here: Intl.DateTimeFormat and
// toLocaleDateString/toLocaleTimeString stay allowed.
const ALLOWED = new Set(["lib/shared/format.ts"]);
const HAND_FORMAT = /\.toLocaleString\(|Intl\.NumberFormat|\.toFixed\(/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) return [];
    return [full];
  });
}

const root = process.cwd();
const files = ["app", "components", "lib"].flatMap(d => sources(join(root, d))).map(f => ({
  path: relative(root, f).split(sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

describe("BR-UI-008 one shared number formatter", () => {
  it("no file outside lib/shared/format.ts formats a number itself (chủ quán chốt 07/10/2026)", () => {
    const offenders = files
      .filter(f => !ALLOWED.has(f.path) && HAND_FORMAT.test(f.src))
      .map(f => f.path)
      .sort();
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Prove red** — `git stash` is not used (the dev server runs on this tree). Instead: `git worktree add --detach <scratch>/gK1 ca5728b6`, copy the guard file in, junction `node_modules`, run `npx vitest run lib/shared/format.guard.test.ts` there. Expected: FAIL listing the 17 files (wrong value: a non-empty list). Remove the worktree.

- [ ] **Step 3: Run green on this branch**

Run: `npx vitest run lib/shared/format.guard.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/shared/format.guard.test.ts
git commit -m "test(guard): only lib/shared/format.ts may format a number for the screen (BR-UI-008)"
```

---

### Task 7: Old-mark expectations in screen tests, docs, five gates (Opus)

**Files:**
- Modify: every `*.test.tsx` / `*.test.ts` under `app/` and `components/` that fails only because it expects old marks (`components/ui/MoneyInput.test.tsx` among them).
- Modify: `docs/02-rules/business-rules/screens.md` (BR-UI-008 status line).
- Modify: `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md` (1b line: K1 done).

- [ ] **Step 1:** Run `npx vitest run`, collect the failing files. For each failure, read the assertion: change it only if the expected text is a formatted number in the old marks (`"15.000"` → `"15,000"`, `"1,5 hộp"` → `"1.5 hộp"`, `"45,3%"` → `"45.3%"`). Any other failure is a real bug: stop and use `superpowers:systematic-debugging`.
- [ ] **Step 2:** `MoneyInput.test.tsx`: displayed values flip (`"150.000"` → `"150,000"`); rename "Backspace right after a dot" / "Delete right before a dot" to "…a comma" and their typed strings accordingly; the paste test keeps pasting `"150.000đ"` (dot dropped, shows `"150,000"`, hidden `"150000"`) and gains a sibling pasting `"150,000đ"` with the same result. Add Review Focus 4: typing `150.5` shows `"1,505"`.
- [ ] **Step 3:** `screens.md` BR-UI-008 status: "Built for every screen in wave K1 (date of commit); number boxes get the comma grouping and worked example with `NumberInput` in wave K2."
- [ ] **Step 4:** Five gates: `npx tsc --noEmit`; `npx vitest run` (report "N passed / M files"); `npx vite-node scripts/check-rules-current.ts`; `npx vite-node scripts/doc-checks/run-blocking.ts`; `npm run build` in a throwaway worktree (`bwt12`).
- [ ] **Step 5:** Commit, then fresh-context review (`reviewer` agent) of the K1 range against this plan and the spec; fix what it confirms; tell the owner what to look at and that the POS shows `25,000` from this push, before asking to push.

## Self-review notes

- Spec 2.7 bullets → Tasks 1, 3, 4, 5, 6. Spec 2.2 decimal helpers → Task 2 (box itself: wave K2). Spec 5 test list → Tasks 1–3, 5, 7. Spec 6 cross-impacts → Task 7 step 5 (owner told before push).
- Not in K1 by design (spec section 4): `NumberInput`, worked example placeholder, `type="number"` guard, button/table guards — wave K2.
