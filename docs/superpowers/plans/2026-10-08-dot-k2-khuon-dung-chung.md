# Đợt K2 — dựng khuôn dùng chung cho từng thành phần màn hình (BR-UI-005)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Who does which task is fixed by `CLAUDE.md` ("Ai viết code"): `lib/` and its tests → Sonnet; screens and shared components (`.tsx` under `app/`, `components/`) → Gemini via `agy`; component tests written before the component, guard test, docs, review → Opus.

**Goal:** The shared parts every screen will use from wave K3 on exist in `components/ui/` and look like the sample page the owner approved: buttons, number boxes (money boxes included), text boxes, selects, labelled fields, tables, the totals box; `DataList` already wears the new table look; a guard test lists every file still off-template, and that list may only shrink.

**Architecture:** The keystroke logic of a number box (keep digits and one dot, insert commas, put the caret back, refuse a fourth decimal, notice a typed comma) becomes one pure function in `lib/shared/number-edit.ts`, built on the K1 helpers in `lib/shared/money-digits.ts`. `NumberInput` is a thin React shell around it; `MoneyInput` keeps its name and every test and becomes `NumberInput` with 0 decimals. The other templates are plain styled components. Screens move onto them in waves K3–K6; this wave moves only the callers that must change for the build to pass, the two money boxes, and `DataList`.

**Tech Stack:** TypeScript, Next.js App Router, React 18, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (sections 2.1–2.6, 3, 4 row K2, 5). Rules: `BR-UI-005`, `BR-UI-003`, `BR-UI-001`, `BR-UI-008` in `docs/02-rules/business-rules/screens.md`; `BR-CASH-005` in `docs/02-rules/business-rules/cash-book.md`.

Kế hoạch này xoá khi chủ quán nhận đợt K2.

## Hiện trạng

Đo 2026-10-08 trên các file `.tsx` trong `app/admin`, `app/settings`, `components` (trừ `components/ui`), không tính test, bỏ chú thích.

1. **Trạng thái.** Không áp dụng cho dữ liệu, vì đợt này không thêm bảng hay trạng thái nào. Ô nhập có ba trạng thái hiển thị: bình thường, đang chọn (viền nâu), sai (viền đỏ, chữ đỏ dưới ô). Ô số có thêm một dòng nhắc tạm: "Số lẻ dùng dấu chấm, ví dụ 1.5", hiện khi vừa gõ dấu phẩy, mất ở lần gõ kế tiếp không có dấu phẩy (chủ quán chốt 2026-10-08).
2. **Nút.** 120 thẻ `<button>` tự vẽ, 37 chỗ dùng `Button`. 43 file tự tô nền nâu hoặc đỏ đặc cho nút hay liên kết. `Button` hôm nay có năm kiểu (`primary`, `secondary` nền màu đường kẻ, `ghost`, `danger`, `warning`) và ba cỡ (32, 44, 48px). Sau đợt này còn bốn kiểu theo trang mẫu: Chính (`primary`), Phụ (`secondary`, nền trắng, viền), Xoá (`delete`, nền trắng, viền và chữ đỏ), Xác nhận xoá (`danger`, đỏ đặc); một cỡ 44px. `ghost` gộp vào Phụ; `warning` gộp vào Xoá, trừ nút "Áp dụng" kiểm kê (xem câu 7). Nút "Tạo" trên danh sách là liên kết: `Button` nhận `href`. Không nút nào bị ẩn hay hiện thêm; đổi kiểu thì 17 nút Phụ đang có đổi từ nền xám sang nền trắng viền mảnh ngay đợt này.
3. **Danh sách.** `DataList` (17 trang) đổi tiêu đề cột: bỏ in hoa, bỏ giãn chữ, chữ 13px đậm vừa, xám, nền màu trang; mọi ô dòng 14px, độ đậm thường. Thêm chỗ cho dòng tổng ngay dưới tiêu đề (máy tính) và thẻ tổng đầu tiên (điện thoại); chưa trang nào dùng chỗ này, việc cộng cột nào là `BR-UI-004`, làm riêng. 22 file tự vẽ `<table>`, 21 file có ô `<td>` in đậm: chuyển ở K3–K6.
4. **Ô nhập.**
   - `NumberInput`: nhận chữ số và một dấu chấm; tự chèn dấu phẩy; số chữ số lẻ do trang khai (0 đến 6); gõ quá thì phím bị bỏ; không nhận dấu trừ; ví dụ mờ "Ví dụ: 1,250.5" (có phần lẻ), "Ví dụ: 12" (số nguyên) hoặc ví dụ trang đưa; đơn vị đứng trong ô bên phải.
   - Báo sai dưới ô: "Cần nhập số." (ô bắt buộc để trống, lúc bấm gửi); "Nhập số lớn hơn 0." / "Nhập số lớn hơn {min}." / "Nhập số từ {min} trở lên." (lúc rời ô); câu trang đưa hoặc "Nhập số không quá {max}." (lúc rời ô). Gõ lại thì câu báo sai mất, rời ô thì kiểm lại.
   - `MoneyInput` (Sổ thu chi, Chuyển tiền): giữ nguyên cách gõ và 15 chữ số; ví dụ mờ đổi từ "VD: 150,000" thành "Ví dụ: 150,000" (Chuyển tiền: "Ví dụ: 500,000"), theo spec mục 2.2. Ô tiền không hiện dòng nhắc dấu phẩy.
   - `TextInput`, `Select`: cao 44px, nền trắng, viền mảnh, viền nâu khi đang chọn, viền đỏ khi sai. `Field`: nhãn trên ô, gợi ý xám dưới ô, báo sai thay chỗ gợi ý.
   - 12 ô `type="number"` còn lại: chuyển ở K3–K5.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ mọi trang quản trị và trang đổi mật khẩu, từ K3 trở đi. Cố ý không đụng: máy bán hàng (`app/pos`, có khuôn riêng cho tay bấm), trang đăng nhập và hai trang báo lỗi (nhận diện riêng, ngoài phạm vi spec), máy chủ, dữ liệu. Không đổi chữ hiển thị nào ngoài ví dụ mờ của hai ô tiền.

Câu hỏi riêng của việc này:

6. **Đợt này chủ quán thấy gì khác?** Ba chỗ: nút Phụ đổi nền trắng viền mảnh ở 17 chỗ; tiêu đề cột ở 17 trang danh sách thôi in hoa; ví dụ mờ hai ô tiền. Các khuôn còn lại chưa trang nào dùng, nên chưa thấy.
7. **Nút "Áp dụng" ở trang kiểm kê đang kiểu `warning` (đỏ).** Spec gộp `warning` vào Xoá, nhưng "Áp dụng" là việc chính của màn, không phải xoá. Theo bảng nút ở spec mục 2.1 ("Chính: việc quan trọng nhất của màn"), nút này thành Chính (nâu). Đây là đổi màu một nút chủ quán sẽ thấy; báo ở lần đẩy.
8. **Có làm máy bán hàng ngừng nhận đơn không?** Không. Không file nào trong `app/pos` bị đụng.
9. **Ví dụ bằng số thật.** Không áp dụng, vì đợt này không đọc hay ghi dữ liệu thật; ví dụ gõ phím nằm trong test của Task 1 và Task 2.

Đã xem: spec `2026-10-07-khuon-thanh-phan-design.md` toàn văn; `components/ui/Button.tsx`, `MoneyInput.tsx`, `MoneyInput.test.tsx`, `PageHeader.tsx`, `Badge.tsx`, `list/ListPageHeader.tsx`, `detail/DetailHeader.tsx`, phần đầu và tên lớp của `list/DataList.tsx`; `lib/shared/money-digits.ts`; `app/admin/no-popups.test.ts`, `app/admin/page-headings.test.ts`; `tailwind.config.ts` (màu, bo góc); mọi chỗ gọi `Button` với `ghost`, `warning`, `danger`, `size`; hai chỗ gọi `MoneyInput` và test của chúng.
Chưa xem: phần thân `DataList.test.tsx` (Task 4 chạy nó trước khi sửa); từng chỗ trong 120 nút tự vẽ (việc của K3–K6).

## Global Constraints

- Copy rules (spec 2.2, verbatim): "Cần nhập số." · "Số lẻ dùng dấu chấm, ví dụ 1.5" · "Nhập số lớn hơn 0." · "Nhập số từ {min} trở lên." · "Nhập số không quá {max}." · placeholder "Ví dụ: 1,250.5" / "Ví dụ: 150,000" / "Ví dụ: 12". Numbers inside messages go through `formatNumber` (`BR-UI-008`).
- All visible text Vietnamese (`BR-UI-001`); code and comments English.
- No file outside `lib/shared/format.ts` calls `toLocaleString`, `Intl.NumberFormat` or `toFixed` (existing guard `lib/shared/format.guard.test.ts`).
- No popups (`BR-DATA-007`): errors show under the box, never in a dialog or the browser's bubble.
- Every control is 44px tall; colours from tokens only: `primary` #8A5A1F, `primary-hover`, `primary-soft`, `page`, `surface-card`, `text-primary`, `text-secondary`, `border`, `danger`; radii `rounded-button` (8px) for controls, `rounded-card` (12px) for boxes.
- Desktop and phone both usable for each template (`.claude/rules/ui-devices.md`): controls full width of their column; tables desktop-only with a phone card alongside; `inputMode` numeric/decimal on every number box.
- `MoneyInput` keeps its name, its props except `placeholder`/`className`, and every test in `components/ui/MoneyInput.test.tsx` green unchanged.
- No negative numbers in any box (spec 2.2).
- Server actions untouched: hidden inputs carry the same plain text as today (`150000`, `1250.5`).
- Never delete a test; a test changed for a reason states it in the commit.

## Review Focus

1. A caret in the middle of `1,250.5` (between `2` and `5`) and a digit typed there: the number gains the digit where typed and the caret stays right after it; the comma moves, the caret does not jump to the end. Pinned in Task 1 (`applyNumberEdit` mid-insert case).
2. Backspace right after a comma in a decimal box (`1,000.5`, caret after the comma): removes the `1`, shows `0.5`, never `.5` or `000.5`. Pinned in Task 1.
3. A controlled box where the page re-sends the same number while the user has typed `5.`: the trailing dot stays (the page only resets the text when the number really differs). Pinned in Task 2.
4. Typing a comma into a box whose text is already grouped (`1,250` then `,`): the hint shows and the number stays 1250. Pasting an already-grouped `1,250.5`: no hint. Pinned in Task 1.
5. A required money box left empty and the form submitted: "Cần nhập số." under the box, no browser bubble, form not sent. Pinned in Task 2.

---

### Task 1: Keystroke logic of a number box (Sonnet)

**Files:**
- Create: `lib/shared/number-edit.ts`
- Test: `lib/shared/number-edit.test.ts`

**Interfaces:**
- Consumes (exists, `lib/shared/money-digits.ts`): `normalizeNumberText(raw, decimals): string | null`, `groupNumberText(text): string`, `caretAfterFormat(charsLeftOfCaret, formatted): number`, `removeDigitAcrossDot(digits, digitsLeftOfCaret, direction)`.
- Produces:

```ts
export interface NumberEditInput {
  prevText: string;          // canonical text before the keystroke, e.g. "1250.5" ("" = empty)
  raw: string;               // the box's value after the browser applied the keystroke
  caret: number;             // selectionStart in `raw`
  inputType?: string | null; // InputEvent.inputType when the browser gives one
  decimals: number;          // 0..6
  zeroIsEmpty?: boolean;     // money: a lone 0 empties the box (BR-CASH-005)
}
export type NumberEditResult =
  | { accepted: true; text: string; display: string; caret: number; commaHint: boolean }
  | { accepted: false; display: string; caret: number };

export function applyNumberEdit(input: NumberEditInput): NumberEditResult;
// number -> canonical text with at most `decimals` places, no exponent, no commas.
export function numberToText(value: number | null | undefined, decimals: number): string;
```

Rules `applyNumberEdit` follows (from `components/ui/MoneyInput.tsx` `handleChange`, generalised):
- Count "kept characters" left of the caret: digits, plus `.` when `decimals > 0`.
- `normalizeNumberText(raw, decimals)` null → reject: `display = groupNumberText(prevText)`, caret = where it was before the keystroke (kept chars left of caret minus the kept chars the keystroke added, never below 0), mapped through `caretAfterFormat`.
- Else `next` (and `""` when `zeroIsEmpty` and `next === "0"`). If `next !== prevText` → accept, caret = `caretAfterFormat(keptLeft, groupNumberText(next))`.
- Else if `inputType` is `deleteContentBackward`/`deleteContentForward` → `removeDigitAcrossDot` on `prevText` at `keptLeft`, then re-normalise (so `000.5` becomes `0.5`, and with `zeroIsEmpty` a lone `0` becomes `""`); accept if it changed.
- Else accept with `text = prevText` (a dropped character), caret mapped the same way.
- `commaHint` is true only when `decimals > 0`, `raw` holds more commas than `groupNumberText(prevText)`, and `raw` is not exactly `groupNumberText(text)` (an already-grouped paste is not a mistake).
- `numberToText`: null/undefined/non-finite → `""`; else round to `decimals` places with `Math.round(value * 10 ** decimals) / 10 ** decimals` and `String(...)`; negative → `""` (no negatives, spec 2.2). Never `toFixed` (guard).

- [ ] **Step 1: Write the failing tests** — `lib/shared/number-edit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyNumberEdit, numberToText } from "./number-edit";

const edit = (prevText: string, raw: string, caret = raw.length, extra: Partial<Parameters<typeof applyNumberEdit>[0]> = {}) =>
  applyNumberEdit({ prevText, raw, caret, decimals: 3, ...extra });

describe("applyNumberEdit (BR-UI-008, spec 2.2)", () => {
  it("groups 1250.5 typed in one go as 1,250.5", () => {
    expect(edit("", "1250.5")).toEqual({ accepted: true, text: "1250.5", display: "1,250.5", caret: 7, commaHint: false });
  });
  it("keeps the caret after a digit typed mid-number: 1,250.5 + 9 after the 2", () => {
    // browser shows "1,2950.5", caret after the 9 (index 4)
    expect(edit("1250.5", "1,2950.5", 4)).toMatchObject({ text: "12950.5", display: "12,950.5", caret: 4 });
  });
  it("refuses a 4th decimal and puts the caret back", () => {
    expect(edit("1.234", "1.2345", 6)).toEqual({ accepted: false, display: "1.234", caret: 5 });
  });
  it("refuses a 16th integer digit", () => {
    expect(edit("123456789012345", "1234567890123456", 16, { decimals: 0 }).accepted).toBe(false);
  });
  it("keeps 0.5 and turns .5 into 0.5", () => {
    expect(edit("", "0.5")).toMatchObject({ text: "0.5", display: "0.5" });
    expect(edit("", ".5")).toMatchObject({ text: "0.5", display: "0.5" });
  });
  it("drops letters and a second dot from a paste", () => {
    expect(edit("", "1,250.5abc")).toMatchObject({ text: "1250.5", display: "1,250.5" });
    expect(edit("1.5", "1.5.", 4)).toMatchObject({ text: "1.5", display: "1.5" });
  });
  it("drops a minus sign", () => {
    expect(edit("", "-5")).toMatchObject({ text: "5" });
  });
  it("drops the dot in a 0-decimal box", () => {
    expect(edit("150", "150.", 4, { decimals: 0 })).toMatchObject({ text: "150", display: "150", commaHint: false });
  });
  it("hints when a comma is typed in a decimal box and keeps the number", () => {
    expect(edit("1", "1,")).toMatchObject({ text: "1", display: "1", commaHint: true });
    expect(edit("1250", "1,250,")).toMatchObject({ text: "1250", display: "1,250", commaHint: true });
  });
  it("does not hint on the next keystroke without a comma", () => {
    expect(edit("1", "15")).toMatchObject({ text: "15", commaHint: false });
  });
  it("does not hint for a pasted, already grouped 1,250.5", () => {
    expect(edit("", "1,250.5")).toMatchObject({ text: "1250.5", commaHint: false });
  });
  it("does not hint while digits are typed into a grouped number", () => {
    expect(edit("1250", "1,2509")).toMatchObject({ text: "12509", display: "12,509", commaHint: false });
  });
  it("never hints in a 0-decimal box", () => {
    expect(edit("1", "1,", 2, { decimals: 0 })).toMatchObject({ commaHint: false });
  });
  it("Backspace right after a comma removes the digit before it, and 000.5 reads 0.5", () => {
    // "1,000.5", caret after the comma (2); the browser deletes the comma -> "1000.5", caret 1
    expect(edit("1000.5", "1000.5", 1, { inputType: "deleteContentBackward" })).toMatchObject({ text: "0.5", display: "0.5" });
  });
  it("Delete right before a comma removes the digit after it", () => {
    // "1,500,000", caret before the 2nd comma (5); Delete removes it -> "1,500000"
    expect(edit("1500000", "1,500000", 5, { decimals: 0, inputType: "deleteContentForward" })).toMatchObject({ text: "150000", display: "150,000" });
  });
  it("money: a lone 0, or zeros left after a Backspace, empty the box", () => {
    expect(edit("", "0", 1, { decimals: 0, zeroIsEmpty: true })).toMatchObject({ text: "", display: "" });
    expect(edit("1000000", "1000,000", 1, { decimals: 0, zeroIsEmpty: true, inputType: "deleteContentBackward" })).toMatchObject({ text: "" });
  });
  it("a decimal box keeps a lone 0 so 0.5 can be typed", () => {
    expect(edit("", "0")).toMatchObject({ text: "0", display: "0" });
  });
});

describe("numberToText", () => {
  it("writes a stored number as box text with a dot and no commas", () => {
    expect(numberToText(1250.5, 3)).toBe("1250.5");
    expect(numberToText(2.5, 3)).toBe("2.5");
    expect(numberToText(1.23456, 3)).toBe("1.235");
    expect(numberToText(150000, 0)).toBe("150000");
  });
  it("empty for nothing, NaN, Infinity or a negative", () => {
    for (const v of [null, undefined, NaN, Infinity, -1]) expect(numberToText(v as number, 3)).toBe("");
  });
});
```

- [ ] **Step 2: Run, expect red** — `npx vitest run lib/shared/number-edit.test.ts` → FAIL, cannot resolve `./number-edit` (missing module, not a wrong value).
- [ ] **Step 3: Implement** `lib/shared/number-edit.ts` per the rules above, comments in English, reusing the K1 helpers (no copy of their logic).
- [ ] **Step 4: Run, expect green** — same command → all pass. Then `npx vitest run lib/shared components/ui/MoneyInput.test.tsx` → green (nothing else changed).
- [ ] **Step 5: Commit** — `git add lib/shared/number-edit.ts lib/shared/number-edit.test.ts` · `feat(lib): one keystroke rule for every number box: digits, one dot, commas inserted, caret kept (BR-UI-008)`.

### Task 2: `NumberInput`, and `MoneyInput` on top of it (Opus tests, Gemini component)

**Files:**
- Create: `components/ui/NumberInput.tsx`, `components/ui/NumberInput.test.tsx`
- Modify: `components/ui/MoneyInput.tsx`; `app/admin/finance/components/CashEntryForm.tsx` (~line 115–125); `app/admin/finance/transfers/components/CashTransferForm.tsx` (~line 114–124)
- Modify tests: `app/admin/finance/components/CashEntryForm.test.tsx:38`, `app/admin/finance/transfers/components/CashTransferForm.test.tsx:72,99` (placeholder text)

**Interfaces:**
- Consumes: `applyNumberEdit`, `numberToText` (Task 1); `numberTextToValue`, `groupNumberText` (`lib/shared/money-digits.ts`); `formatNumber` (`lib/shared/format.ts`).
- Produces:

```ts
export interface NumberInputProps {
  id: string;
  decimals: number;                  // 0..6
  name?: string;                     // form mode: a hidden input posts the canonical text ("1250.5")
  defaultValue?: number | string | null;
  value?: number | null;             // page-held mode
  onValueChange?: (value: number | null) => void;
  unit?: string;                     // "ml", "g", "đ", "%": fixed at the right inside the box
  example?: string;                  // shown as "Ví dụ: {example}"; default "1,250.5" (decimals>0) or "12"
  hint?: string;                     // grey line under the box; an error replaces it
  error?: string;                    // the page's own error; wins over the box's own
  required?: boolean;
  min?: number;                      // with minExclusive: must be above min
  minExclusive?: boolean;
  max?: number;
  maxMessage?: string;
  zeroIsEmpty?: boolean;             // MoneyInput passes true
  disabled?: boolean;
  [ariaProp: `aria-${string}`]: string | undefined;
}
export function NumberInput(props: NumberInputProps): JSX.Element;
```

`MoneyInput` props after this task: `id`, `name`, `defaultValue`, `required`, `example?` (default `"150,000"`), aria-*; `className` and `placeholder` removed (the template owns the look).

- [ ] **Step 1 (Opus): write `components/ui/NumberInput.test.tsx`** covering: plain text box (`type="text"`), `inputMode` decimal/numeric; typing `1250.5` shows `1,250.5` and the hidden input posts `1250.5`; caret restored via `setSelectionRange` after a comma appears; a 4th decimal refused; placeholders "Ví dụ: 1,250.5", "Ví dụ: 12", "Ví dụ: 150,000" (via `example`); unit text inside the box; typed comma shows "Số lẻ dùng dấu chấm, ví dụ 1.5" and the next comma-free keystroke clears it; already grouped paste shows no hint; 0-decimal box never hints; required empty box + `invalid` event shows "Cần nhập số." and the event's default is prevented (no browser bubble); blur on `0` with `min=0 minExclusive` shows "Nhập số lớn hơn 0."; blur under `min=2` shows "Nhập số từ 2 trở lên."; blur over `max=3200` with `maxMessage` shows that sentence, without it "Nhập số không quá 3,200."; typing again clears the message; `hint` shows and an `error` replaces it, the box gets `aria-invalid="true"` and `aria-describedby` pointing at the message; page-held mode reports `5` for `5.` while the box keeps `5.`, and a new `value` from the page (`2.5`) shows `2.5`; a re-sent equal value keeps `5.`; the mouse wheel does not change the value.
- [ ] **Step 2 (Opus): run, expect red** — `npx vitest run components/ui/NumberInput.test.tsx` → FAIL, cannot resolve `./NumberInput` (missing component).
- [ ] **Step 3 (Opus): change the two money-box placeholder expectations** to "Ví dụ: 150,000" and "Ví dụ: 500,000"; run `npx vitest run app/admin/finance` → those 3 tests red on the old placeholder (wrong value).
- [ ] **Step 4 (Gemini): build** `NumberInput.tsx` (client component; text state seeded from `defaultValue`/`value` via `numberToText`; every change goes through `applyNumberEdit`; on reject write `display` back to the DOM and restore the caret; on accept set state and restore the caret in a layout effect as `MoneyInput` does today; page-held mode resyncs only when `numberTextToValue(text) !== value`; message line under the box; `setCustomValidity` + `onInvalid` with `preventDefault` for "Cần nhập số."; form `reset` empties the box; 44px tall, `rounded-button`, white, `border-border`, brown border on focus, red border + red message when wrong, unit absolutely placed at the right with matching right padding, `text-right tabular-nums`; same on phone and desktop, full width of its column). Rewrite `MoneyInput.tsx` as `NumberInput` with `decimals={0}`, `zeroIsEmpty`, `example` default `"150,000"`. In the two finance forms drop the `className` and `placeholder` from `<MoneyInput>` and pass `example="500,000"` on the transfer form only.
- [ ] **Step 5 (Opus): run, expect green** — `npx vitest run components/ui app/admin/finance` → all pass, `MoneyInput.test.tsx` unchanged. `npx tsc --noEmit` clean.
- [ ] **Step 6 (Opus): commit** — tests first in their own commit (`test(ui): NumberInput behaviour from spec 2.2; money-box hints read Ví dụ:`), then the component (`feat(ui): NumberInput, the one number box; MoneyInput is NumberInput with 0 decimals (BR-UI-005)`).

### Task 3: `Button`, `Field`, `TextInput`, `Select`, `Table` set, `MoneySummary` (Opus tests, Gemini components)

**Files:**
- Modify: `components/ui/Button.tsx`
- Create: `components/ui/Field.tsx`, `components/ui/TextInput.tsx`, `components/ui/Select.tsx`, `components/ui/Table.tsx`, `components/ui/MoneySummary.tsx`
- Test: `components/ui/Button.test.tsx`, `components/ui/Field.test.tsx`, `components/ui/Table.test.tsx`, `components/ui/MoneySummary.test.tsx`
- Modify callers that stop compiling: `app/admin/orders/OrderTable.tsx` (225, 472, 483), `app/admin/orders/components/VoidOrderButton.tsx` (61), `app/admin/products/components/ProductForm.tsx` (164, 205–206), `app/admin/inventory/stocktake/components/StocktakeClient.tsx` (341)

**Interfaces:**
- Produces:

```ts
// Button.tsx
type Variant = "primary" | "secondary" | "delete" | "danger"; // danger = the final confirm step, solid red
type ButtonProps = { variant?: Variant; loading?: boolean; className?: string /* layout only */ } &
  (({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>) | { href: string; children: React.ReactNode });
export function Button(props: ButtonProps): JSX.Element; // href -> next/link styled the same

// Field.tsx
export function Field(props: { label: string; htmlFor: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }): JSX.Element;
// message ids: `${htmlFor}-message`; children are expected to set aria-describedby themselves via `fieldMessageId(htmlFor)`
export function fieldMessageId(htmlFor: string): string;

// TextInput.tsx / Select.tsx — every native prop except className and style
export const TextInput: React.ForwardRefExoticComponent<Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "style"> & { invalid?: boolean } & React.RefAttributes<HTMLInputElement>>;
export const Select: React.ForwardRefExoticComponent<Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className" | "style"> & { invalid?: boolean } & React.RefAttributes<HTMLSelectElement>>;

// Table.tsx — desktop table; the page draws its own phone cards
export function Table(props: { children: React.ReactNode; "aria-label"?: string }): JSX.Element;
export function TableHead(props: { children: React.ReactNode }): JSX.Element;      // <thead><tr>
export function TableHeaderCell(props: { children?: React.ReactNode; align?: "right" }): JSX.Element;
export function TableBody(props: { children: React.ReactNode }): JSX.Element;
export function TableRow(props: { children: React.ReactNode }): JSX.Element;
export function TableCell(props: { children?: React.ReactNode; align?: "right"; colSpan?: number }): JSX.Element;
export function TableTotalRow(props: { children: React.ReactNode }): JSX.Element;  // right under the header, bg primary-soft
export function TotalCard(props: { items: { label: string; value: React.ReactNode }[] }): JSX.Element; // phone: first card, bg primary-soft

// MoneySummary.tsx
export function MoneySummary(props: { lines: { label: string; value: React.ReactNode }[]; total: { label: string; value: React.ReactNode } }): JSX.Element;
```

Looks (spec 2.1, 2.3–2.5): all controls `min-h-[44px]`, `rounded-button`, 14px medium for buttons; Phụ `bg-surface-card border border-border text-text-primary`; Xoá `bg-surface-card border border-danger text-danger`; Xác nhận xoá `bg-danger text-white`; Chính `bg-primary text-on-primary`. Labels 13px medium; hint 12px `text-text-secondary`; error 12px `text-danger`, `role="alert"`. Header cells 13px medium `text-text-secondary bg-page`, no `uppercase`, no `tracking-*`; row cells 14px `font-normal`; `align="right"` → `text-right tabular-nums`. MoneySummary: `bg-surface-card border border-border rounded-card`; label left grey, value right; total line has a top border and larger bold text.

- [ ] **Step 1 (Opus): write the four test files.** Button: `href` renders a link with that `href` and the same classes; each variant carries `min-h-[44px]`; `secondary` has `bg-surface-card` and `border-border` and not `bg-surface-secondary`; `delete` has `text-danger border-danger` and no solid `bg-danger`; `danger` has `bg-danger`; `loading` disables. Field: `getByLabelText(label)` finds the control; hint shown; `error` replaces hint and has `role="alert"`; TextInput/Select with `invalid` get `aria-invalid="true"`. Table: header cell has no `uppercase` class; `align="right"` cell has `text-right` and `tabular-nums`; a `<td>` has no `font-bold`/`font-semibold`/`font-medium`; `TableTotalRow` row has `bg-primary-soft`; `TotalCard` lists label and value. MoneySummary: every line's label and value shown in order, the total last.
- [ ] **Step 2 (Opus): run, expect red** — `npx vitest run components/ui/Button.test.tsx components/ui/Field.test.tsx components/ui/Table.test.tsx components/ui/MoneySummary.test.tsx` → Button tests red on wrong classes / no link (wrong value), the other three red on missing modules.
- [ ] **Step 3 (Gemini): build the five components and rewrite `Button.tsx`;** fix the callers: `ghost` → `secondary` (OrderTable 225 is a delete-opening button: `delete`, drop its `!text-danger` override), remove every `size=` prop, StocktakeClient 341 `warning` → `primary`.
- [ ] **Step 4 (Opus): run, expect green** — same command, plus `npx vitest run app/admin/orders app/admin/products app/admin/inventory/stocktake` and `npx tsc --noEmit`.
- [ ] **Step 5 (Opus): commit** — tests first, then `feat(ui): one look each for buttons, fields, text boxes, selects, tables and the totals box (BR-UI-005)`.

### Task 4: `DataList` wears the table template (Opus test, Gemini component)

**Files:**
- Modify: `components/ui/list/DataList.tsx`
- Test: `components/ui/list/DataList.test.tsx` (add cases, keep every existing one)

**Interfaces:**
- Consumes: `TableHeaderCell`, `TableCell`, `TableTotalRow`, `TotalCard`, `Button` (Task 3).
- Produces: `DataListProps<T>` gains `totals?: { label: string; values: Record<string, React.ReactNode> }` — keyed by column `key`; the desktop total row puts `label` in the first column cell that has no value of its own; the phone `TotalCard` lists `label` then each column header with its value.

- [ ] **Step 1 (Opus): add tests** — header cells have no `uppercase`; no row `<td>` has a bold weight; with `totals` a row with `bg-primary-soft` sits right after the header row and shows each value; without `totals` no such row; phone: a total card is the first card. The bulk-delete button ("Xoá n dòng") is a `Button` `delete` (outline), since a yes/no question follows it.
- [ ] **Step 2 (Opus): run, expect red** — `npx vitest run components/ui/list/DataList.test.tsx` → new cases red (wrong value: `uppercase` present, no total row).
- [ ] **Step 3 (Gemini): restyle `DataList.tsx`** with the Task 3 parts, keep its behaviour, sorting, selection, phone cards and every label; add `totals`.
- [ ] **Step 4 (Opus): run, expect green** — `npx vitest run components/ui/list app/admin/inventory/units` and the 17 list pages' tests: `npx vitest run app/admin`.
- [ ] **Step 5 (Opus): commit** — `feat(ui): list headers in plain grey, even rows, a place for the totals row (BR-UI-003, BR-UI-005)`.

### Task 5: Guard test with the debt lists (Opus)

**Files:**
- Create: `components/ui/template.guard.test.ts`

Scope: `.tsx` in `app/admin`, `app/settings`, `components` except `components/ui`; tests skipped; comments stripped before matching. Five rules (spec section 3; the number-format rule already lives in `lib/shared/format.guard.test.ts`):

| Rule | Pattern | Debt today |
|---|---|---|
| No `type="number"` | `/type=["{]?["']?number/` | 12 files |
| No solid brown or red button/link outside the templates | `/<(button\|Link\|a)\b[^>]*?\bbg-(primary\|danger)(?![-\w/])/` | 43 files |
| No `<table>` outside the templates | `/<table\b/` | 22 files |
| No bold `<td>` | `/<td\b[^>]*?\bfont-(bold\|semibold\|medium)\b/` | 21 files |
| No English in brackets after Vietnamese | `/[À-ỹ][^"'\`<>{}\n]*\(\s*[A-Za-z][A-Za-z ]*[A-Za-z]\s*\)/` minus allowed names (`Topping`, `MR.PHIN`, `PO`) and units (`ml`, `g`, `kg`) | 3 files |

Each rule: `expect(offenders).toEqual(DEBT.sort())` — a new offender is red, a fixed file still listed is red. Each debt list has a comment naming the wave that empties it (K3 Kho, K4 Bán hàng, K5 Tài chính và báo cáo, K6 còn lại).

- [ ] **Step 1: write the test with every debt list empty.**
- [ ] **Step 2: run, expect red** — `npx vitest run components/ui/template.guard.test.ts` → 5 failures listing exactly the measured files (12, 43, 22, 21, 3). Red because offenders exist (wrong value).
- [ ] **Step 3: fill the debt lists** from that output, each file tagged with its wave.
- [ ] **Step 4: run, expect green.**
- [ ] **Step 5: commit** — `test(guard): files still off the shared templates are listed and may only shrink (BR-UI-005)`.

### Task 6: Docs, five gates, review (Opus)

**Files:** `docs/02-rules/business-rules/screens.md` (BR-UI-005 status), `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (status line), `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md` (1b: K2 done), `docs/04-operations/OPEN-ITEMS.md` (regenerated only).

- [ ] **Step 1:** BR-UI-005 status: "Templates built in wave K2 on 2026-10-08 (`components/ui/`): Button, NumberInput (MoneyInput on top), TextInput, Select, Field, Table set, MoneySummary; DataList follows. Screens move in waves K3–K6; `components/ui/template.guard.test.ts` lists what is left." Record the Stocktake "Áp dụng" button ruling (warning → primary).
- [ ] **Step 2:** five gates: `npx tsc --noEmit`; `npx vitest run`; `npx vite-node scripts/check-rules-current.ts`; `npx vite-node scripts/doc-checks/run-blocking.ts`; `npm run build` in a throwaway worktree (bwt13).
- [ ] **Step 3:** whole-wave review by a fresh reviewer (most capable model) against this plan and the spec, Review Focus verbatim; one fix pass, each fix red then green.
- [ ] **Step 4:** commit docs.

## Self-review notes

- Spec 2.6 (headers): `ListPageHeader`, `DetailHeader`, `PageHeader` already exist and stay; moving the 12 hand-written `<h1>` and the 6 title-case labels happens screen by screen in K3–K6. No guard for them in spec section 3, so none here.
- Spec 3 `it.todo` in `MoneyInput.test.tsx` stays open: it closes when K3–K5 attach the money box to product prices, modifiers, purchase orders, promotions and asset disposal.
- Money-box placeholder text changes from "VD:" to "Ví dụ:", matching spec 2.2's wording; tests changed in Task 2 with that reason.
