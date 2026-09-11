# Báo cáo tài chính: đổi tên và làm lại giao diện theo bản thử — Kế hoạch

> **For agentic workers:** one fresh agent per Mục, reviewed between Mục
> (owner's standing instruction). Steps use `- [ ]`. Critique this plan before
> coding; if you find it clean, say so explicitly.

**Goal:** the monthly P&L page (`/admin/reports/pnl`) is renamed "Báo cáo tài
chính" and looks like the sample the owner approved on 2026-09-11, with his
fifteen notes of 2026-09-11 applied on top.

**Why:** the design says "Theo đúng trang thử" (spec, "Trang trông thế nào"),
but the 2026-09-11 plan carried the sample's content and not its look. The owner
opened the live page, compared it with the two sample screenshots, and left
fifteen notes through the Góp ý tool (`UI-FEEDBACK.md`, route
`/admin/reports/pnl`). This is an edit to a page that exists: short design here,
then code (CLAUDE.md, "Quy trình"). No table, no migration, no new route.

**Spec:** `docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md`.
**Sample** (the look to copy; read it before Mục 2 and 3): artifact
`https://claude.ai/code/artifact/bc2aced4-378c-43b5-8cee-93f80cfdf2d7`. Its CSS
is summarised in "Bản thử, tóm tắt" below, so an agent without the artifact
can still work.

## Global constraints

- No push, no deploy, no migration, no `--apply`, no subagents. Never
  `--no-verify`.
- If a hook demands a file outside the Mục's list, or a tool call is
  blocked: STOP and report. Never re-run a blocked call through another tool.
- Do not edit or stage this plan file. Stage only by explicit path.
- A rule change and its test go in the same commit.
- Code and comments in English; everything on screen in Vietnamese.
- No figure changes. Every number the page shows today is the same number
  after this plan, except where a cost is now shown with a minus
  (see "Dấu của chi phí").
- Run after each Mục: `npx tsc --noEmit`, `npx vitest run`,
  `npx vite-node scripts/check-rules-current.ts`,
  `npx vite-node scripts/doc-checks/run-blocking.ts` (then
  `git checkout -- docs/generated/system-map.md`), `npm run build`.

## Hiện trạng

Đã xem: `app/admin/reports/pnl/page.tsx`, `actions.ts`, every file in
`app/admin/reports/pnl/components/`, `lib/reports/profit-and-loss-table.ts` and
its test, `app/globals.css`, `tailwind.config.ts`, `app/admin/layout.tsx` (menu),
the sample's full HTML, `UI-FEEDBACK.md`. Chưa xem: `actions.test.ts`,
`__fixtures__/pnl-2026.ts`, and every `<h1>`–`<h3>` in the app. Only the 9 files
in `app/pos` and `components/` that hold one were counted.

1. **Trạng thái.**
   - The page has two states: a year with data, or a year without data
     (`EmptyState`, unchanged).
   - On a computer, no cell or one cell is open (`useState`, unchanged).
   - On a phone, each card is open or closed (native `<details>`). The year
     card changes from open to **closed** by default: the sample shows it
     closed, as a coloured summary.
2. **Nút.**
   - The year picker changes from buttons that hide when there is only one year
     to a `<select>` labelled "Năm" that is **always shown**. This answers the
     owner's note "title này đang là hardcode": the year was never fixed, but
     with one year the picker was hidden, so it looked fixed.
   - Table cells, "Đóng", phone cards and phone lines are unchanged. Nothing
     new opens from the Tổng or % columns.
3. **Danh sách.**
   - The rows are unchanged, except that "Cộng dồn từ đầu năm" is renamed
     "Luỹ kế".
   - The notes are the same notes, now numbered. A month's column header
     (computer) or card title (phone) carries the numbers of the notes that
     name it.
   - On a phone the four summary figures and the chart are **not shown**,
     as in the sample's phone view. The year card carries the year's net profit
     and revenue.
4. **Ô nhập.** One: the year `<select>`. It offers only `availableYears`, so
   nothing outside the range can be picked. A hand-typed `?year=` that is bad
   or has no data falls back as today.
5. **Loại dữ liệu.** Display only. Nothing is computed differently; no source
   row is read that was not read before, except brand names for the header.

Câu hỏi riêng của việc này:

6. **Phông chữ cho cả hệ thống.** The owner asked for the sample's font
   "áp dụng cho toàn bộ hệ thống".
   - The sample sets headings and big figures in **Outfit** and body text in
     **Plus Jakarta Sans**. The app already loads both (`app/globals.css`
     line 1) and already uses Plus Jakarta Sans for body text; Outfit is loaded
     and used nowhere.
   - So "the whole system" means: every `h1`–`h3` in Outfit, plus a
     `font-display` utility for big figures.
   - Outfit has **no Vietnamese letters**: its Google Fonts ranges stop at
     latin and latin-ext, measured 2026-09-12. So "ờ", "ỗ", "ế" in a heading
     are drawn from Plus Jakarta Sans, the next font in the stack. The sample
     does exactly the same, and that is what the owner saw and asked for.
     Keep the same stack.
7. **Máy bán hàng.** A global heading rule reaches the POS: product names in
   the POS grid are `<h3 … line-clamp-2>`. Outfit is narrower than Plus
   Jakarta Sans, so nothing gets longer, but the owner must look at the POS
   after the push. The report says so.
8. **Cột dính bên phải.** "Tổng" and "% doanh thu" stay visible while the
   months scroll (owner note). This works only if the % column has a fixed
   width and Tổng is offset by exactly that width.

## Bản thử, tóm tắt

The tokens already exist in `app/globals.css` under other names:

| Sample | App token | Value |
|---|---|---|
| `--ground` | `bg-page` | #F6F5F0 |
| `--card` | `bg-surface-card` | #FFFFFF |
| `--band` | `bg-surface-secondary` | #EDEAE0 |
| `--ink` / `--ink-2` / `--muted` | `text-text-primary` / `-secondary` / `-muted` | |
| `--line` | `border-border` | #DBD6C7 |
| `--ochre` / `--ochre-soft` | `primary` / `primary-soft` | #9C6418 / #F1E3C8 |
| `--good` | `success` | #3F7154 |
| `--bad` | `danger` | #9C4430 |

The sample's shapes:

- **Header.**
  - The `h1` is 28px, weight 700.
  - The subtitle under it is 13px, muted.
  - The controls sit at the right: a small uppercase "NĂM" label and a
    `<select>`.
- **Summary figures.**
  - Four white tiles: 1px border, radius 12px, padding 14/16.
  - Label: 12px, uppercase, letter-spacing .04em, muted.
  - Value: Outfit, 24px, weight 600.
  - Sub-line: 12.5px, secondary.
  - The net-profit tile has a green border and a green value.
- **Panel** (the chart, and the table with its notes):
  - white, 1px border, radius 12px;
  - shadow `0 1px 2px rgba(29,42,36,.06), 0 6px 24px rgba(29,42,36,.05)`;
  - header row padded 16/18/6, with the `h2` (17px, weight 600) on the left
    and the legend or hint on the right.
- **Table.**
  - Cells are padded 9px 10px, with a 1px bottom border.
  - The first column is sticky left.
  - The profit rows have a band background and bold text.
  - The sub-row "trong đó ghi tay" is muted, 12.5px, indented 24px.
  - The margin row is muted, 12.5px.
  - Tổng has `border-left: 2px solid` border colour, and bold text.
  - A selected cell has a 2px ochre outline and an ochre-soft background.
- **Notes.**
  - They sit inside the table panel, at the bottom, 13px, secondary.
  - Each note starts with `<sup>` in ochre, weight 700, 10.5px.
  - Money amounts in a note are bold ochre.
- **Phone.**
  - The year card has a band background and no border. It has an uppercase
    eyebrow, then a "Lợi nhuận ròng" row (the label at 16px weight 600, and
    the value in Outfit 20px weight 600, green), then a "Doanh thu" row at
    13px.
  - A month card has two rows. Top: the title at 16px weight 600, and the net
    figure in Outfit 20px (green for a profit, red for a loss). Below: the
    "Doanh thu" label on the left and the revenue figure on the right, 13px,
    secondary.

## Quyết định hiển thị trong kế hoạch này

- **Tên trang: "Báo cáo tài chính"** (owner, 2026-09-12).
  - This changes the menu entry, the `h1`, and one sentence in the cash-category
    form.
  - The route stays `/admin/reports/pnl`: nobody sees it, and changing it
    would break a bookmark.
  - The later cash-flow report (`project_financial-reports-scope`) belongs on
    this same page as a second part. That is a note for the future plan, not
    work for this one.
- **Số rút gọn trên biểu đồ** (owner note `id-e9194e95`: "hiển thị có đơn vị là
  k, triệu thì đơn vị là tr… 100k, 100tr, 100.12k, 100.12tr").
  - Every money figure drawn on the chart uses **one unit** for the whole
    chart: bar labels, axis ticks, and the end label of the line.
  - The unit is `tr` when at least half of the months with a non-zero net
    profit are 1.000.000 or more in size; otherwise it is `k`.
  - A figure shows up to two decimals, with the trailing zero dropped. The
    decimal mark is a **comma**, because a dot is the app's thousands mark:
    "100.12k" would read as a hundred thousand twelve.
  - There is no space before the unit, matching the owner's examples.
  - A figure that rounds to zero shows "0".
- **Luỹ kế** (owner note `id-08158867`). The row "Cộng dồn từ đầu năm"
  becomes "Luỹ kế" everywhere on the page: the row label, the formula, the
  legend and the chart title.
- **Dấu của chi phí.**
  - As in the sample, a cost row shows its value with a minus: Giá vốn,
    Nguyên liệu mua dùng ngay, Hao hụt, each expense group, and Khấu hao.
    The table then reads as a sum from top to bottom: "doanh thu → trừ giá
    vốn → …".
  - These minuses are **not red**. Red stays for a result below zero: Lợi
    nhuận gộp, Lợi nhuận ròng, Biên lợi nhuận and Luỹ kế. Revenue or Thu khác
    would also be red below zero, which cannot happen today.
  - The "% doanh thu" column stays positive, as in the sample.
  - A money cell that is exactly 0 shows "–" (en dash), as in the sample.
  - This is display only: `PnlTable` keeps costs positive, and every test and
    verify script reading it is unaffected.
- **Màu biểu đồ** (owner notes `id-68950865`, `id-e0d2b919`, `id-1b4ee1fe`).
  - The line is green (`success`, #3F7154).
  - The points are white-filled with a green border of the same colour.
  - A profit bar is a lighter green: the new token `--color-chart-profit`,
    #6B9E80.
  - A loss bar stays `danger`.

## Ví dụ bằng số thật

Read-only run of `getProfitAndLossReport(2026)` on 2026-09-12. The owner had
already ticked "Tính là doanh thu bán hàng", and his ice-order edits of
2026-09-11 are in. Net profit by month:

| 03 | 04 | 05 | 06 | 07 | 08 | 09 (đến 12/09) |
|---|---|---|---|---|---|---|
| −49.226 | 8.980.678 | 6.085.470 | 17.179.798 | 13.523.541 | −32.352.964 | 697.353 |

**Chart.**

- **Unit.** 7 months are non-zero, and 5 of them are 1.000.000 or more in
  size, so the unit is `tr`.
- **Bar labels:**

  | 03 | 04 | 05 | 06 | 07 | 08 | 09 |
  |---|---|---|---|---|---|---|
  | -0,05tr | 8,98tr | 6,09tr | 17,18tr | 13,52tr | -32,35tr | 0,7tr |

- **Luỹ kế points:** -0,05tr, 8,93tr, 15,02tr, 32,2tr, 45,72tr, 13,37tr,
  14,06tr. The end label reads "luỹ kế 14,06tr".
- **Axis.**
  - The data runs from −32,35tr to 45,72tr, a span of 78,07tr.
  - A sixth of that is 13,01tr, and the nearest step in {1, 2, 2,5, 5} × 10ⁿ
    at or above it is 20tr.
  - The ticks are therefore -40tr, -20tr, 0, 20tr, 40tr and 60tr.
- **Month labels:** 03/26 … 08/26, and 09/26* for the month still running.

**Tiles** (computer only):

| Tile | Value | Sub-line |
|---|---|---|
| DOANH THU TỪ ĐẦU NĂM | 81.830.868 | từ 03/2026 đến 12/09/2026 |
| LỢI NHUẬN RÒNG TỪ ĐẦU NĂM | 14.064.650, green, green border | biên 17,19% doanh thu |
| THÁNG LỜI NHẤT | 06/2026 | 17.179.798 |
| THÁNG LỖ NHẤT | 08/2026 | -32.352.964 · xem ghi chú 2 |

**Notes, numbered** (the order the code already makes):

1. Doanh thu tháng 04/2026 có **8.411.868đ** ghi tay trong sổ thu chi, không
   qua máy bán hàng.
2. Giá vốn tháng 08/2026 có **34.864.627đ** từ lần kiểm kho ngày 09/08/2026:
   hàng đã dùng mà chưa ghi phiếu xuất, không tính là hao hụt. Các tháng trước
   đó vì vậy có giá vốn thấp hơn thực tế; nhìn dòng Luỹ kế mới thấy đúng bức
   tranh.
3. Doanh thu tháng 04/2026, 05/2026, 06/2026, 07/2026 có phần bán trước ngày
   20/07/2026, ngày bắt đầu có sổ tiền nhận, nên phần đó không có sổ tiền để
   đối chiếu.

**Table header** (computer):

| Khoản | 03/26 | 04/26 ¹,³ | 05/26 ³ | 06/26 ³ | 07/26 ³ | 08/26 ² | 09/26 *(đến 12/09)* | Tổng | % doanh thu |
|---|---|---|---|---|---|---|---|---|---|

The numbers are joined with a comma ("1,3"), never run together: "¹³" reads
as thirteen, a flaw in the sample.

**Cells:**

| Row | Month | Shows |
|---|---|---|
| Giá vốn | 08 | -46.418.990 (not red) |
| Vận hành | 05 | – |
| Lợi nhuận gộp | 08 | -30.476.990 (red) |
| Luỹ kế | 03 | -49.226 (red) |
| Giá vốn | Tổng | -48.146.263, with 58,84% in "% doanh thu" |

Clicking Vận hành 08/26 opens its four rows, each with a minus:

- Dán lại xe Phin Đi -300.000
- Photo giấy bán khoai trứng -35.000
- Phin Đi - Gửi xe -130.000
- Uchako - Gửi xe -150.000

**Phone:**

- The year card, closed, reads "TỪ ĐẦU NĂM" / "Lợi nhuận ròng 14.064.650" /
  "Doanh thu 81.830.868".
- The top month card reads "09/2026 · 697.353" over
  "Doanh thu · đến 12/09 · 5.054.000".
- The 08/2026 card title carries a superscript "2".

No figure in this plan comes from a purchase line, so there is no line code to
quote: nothing is computed.

## Góp ý của chủ quán → Mục

| Note id | Asks for | Mục |
|---|---|---|
| (chat) | Name the page "Báo cáo tài chính" | 2 |
| e9194e95 | Short figures on the chart, one unit | 1 (formatter), 2 (chart) |
| 68950865 | White points with a green border | 2 |
| e0d2b919 | Green line, same green on the point borders | 2 |
| 1b4ee1fe | Profit bars lighter green than the line | 2 |
| 0a23d479 | Chart title at the left, legend at the top right | 2 |
| 08158867 | "Cộng dồn từ đầu năm" → "Luỹ kế" | 1 |
| 4b159c72 | "Tổng" and "% doanh thu" stay put while scrolling | 3 |
| 34e767e0 | A line between the months and Tổng | 3 |
| c876ab9d | White panels per section, like the sample | 2 (chart), 3 (table) |
| 5eba2ebb | Notes like the sample, joined to the table | 1 (numbers), 3 (look) |
| f3060de4 | Title looks hard-coded to 2026 | 2 (year picker always shown) |
| a6586972 | Phone: revenue figure under the profit figure | 3 |
| 5320e073 | Phone: numbered notes, number on the month | 1, 3 |
| e39733be | The sample's font, for the whole system | 2 |
| b2cdc7a3 | Phone: the year card coloured, with the year's revenue | 3 |

---

## Mục 1 — Numbers the page needs, and the rules

**Files:**

- Create: `lib/reports/compact-money.ts`, `lib/reports/compact-money.test.ts`
- Modify: `lib/reports/profit-and-loss-table.ts`, `lib/reports/profit-and-loss-table.test.ts`
- Modify: `app/admin/reports/pnl/__fixtures__/pnl-2026.ts`, but only if a type
  change requires it
- Modify: `docs/02-rules/business-rules/data-integrity.md`,
  `docs/02-rules/business-rules/profit-and-loss.md`

**Interfaces produced** (Mục 2 and 3 rely on these exact names):

```ts
// lib/reports/compact-money.ts
export type CompactUnit = "k" | "tr";
export function pickCompactUnit(values: number[]): CompactUnit;
export function formatCompact(value: number, unit: CompactUnit): string;

// lib/reports/profit-and-loss-table.ts
export interface PnlFootnote {
  key: string;
  number: number;        // 1-based position in `footnotes`
  months: string[];      // "YYYY-MM" months the note is about; [] for the rounding note
  text: string;          // unchanged wording, except the stocktake tail below
  strong: string[];      // substrings of `text` to show in bold, e.g. "8.411.868đ"
}
export interface PnlMonthColumn {
  month: string;         // "YYYY-MM"
  label: string;         // unchanged: "09/2026 (đến 11/09)"
  shortLabel: string;    // unchanged: "09"
  title: string;         // "09/2026"
  head: string;          // "09/26"
  until: string | null;  // "11/09" for the month still running, else null
  notes: number[];       // numbers of the footnotes whose `months` include this month, ascending
}
// PnlTable.footnotes: PnlFootnote[]
// PnlTable.chart items gain `head: string` ("09/26") and `partial: boolean`.
```

**What each function does:**

- **`pickCompactUnit`.**
  - Count the values with `|v| >= 0.5`; call that n.
  - If n is 0, return `"k"`.
  - Return `"tr"` if the values with `|v| >= 1_000_000`, times 2, reach n.
    Otherwise return `"k"`.
- **`formatCompact`.**
  - Divide by 1.000 (`k`) or 1.000.000 (`tr`).
  - Format with `Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 })`.
    It rounds halves away from zero, the rule in BR-DATA-005.
  - If the formatted number is "0" or "-0", return `"0"` with no unit.
    Otherwise append the unit, with no space.
- **The cumulative row.**
  - Its label is `"Luỹ kế"`.
  - Its formula for a month after the first reads `Luỹ kế tháng trước X + lợi
    nhuận ròng tháng này Y = Z`.
  - The first month's formula is unchanged.
- **The stocktake footnote.** When the stocktake month is not the first month
  of the table, append this sentence:
  > Các tháng trước đó vì vậy có giá vốn thấp hơn thực tế; nhìn dòng Luỹ kế mới thấy đúng bức tranh.
- **`months` on each footnote:**

  | Note | `months` | `strong` |
  |---|---|---|
  | manual | that month | the money text with its "đ" |
  | stocktake | that month | the money text with its "đ" |
  | before-payments | the unchecked months | [] |
  | rounding | [] | [] |

- [ ] **Step 1: Write the failing tests.**

  `compact-money.test.ts` pins each of these:
  - `pickCompactUnit([-49_226, 8_980_678, 6_085_470, 17_179_798, 13_523_541, -32_352_964, 697_353])`
    returns `"tr"`.
  - `pickCompactUnit([120_000, 340_000, 90_000, 2_500_000])` returns `"k"`
    (1 of 4 is a million or more).
  - `pickCompactUnit([0, 0])` returns `"k"`.
  - `formatCompact`:

    | Input | Unit | Output |
    |---|---|---|
    | 8_980_678 | tr | "8,98tr" |
    | 697_353 | tr | "0,7tr" |
    | -49_226 | tr | "-0,05tr" |
    | -32_352_964 | tr | "-32,35tr" |
    | 100_000 | k | "100k" |
    | 100_120 | k | "100,12k" |
    | 100_000_000 | tr | "100tr" |
    | 100_120_000 | tr | "100,12tr" |
    | 1_234_500 | k | "1.234,5k" |
    | 0 | tr | "0" |
    | -1_000 | tr | "0" |

  In `profit-and-loss-table.test.ts`:
  - The expected label is now "Luỹ kế", and the formula now begins "Luỹ kế
    tháng trước".
  - Every footnote expectation carries `number`, `months` and `strong`.
  - The chart expectation carries `head` and `partial`.
  - A new test: a stocktake in the second month gets the tail sentence; a
    stocktake in the first month does not.
  - A new test: `months[i].notes` for the BR-SALE-005 case, where
    06/2026 → [1] and 08/2026 → [].
  - A new test: `title`, `head` and `until` for "2026-09" on "2026-09-11",
    which give "09/2026", "09/26" and "11/09".

- [ ] **Step 2: Run them and confirm they fail.** `compact-money` fails because
  the module is missing; the table tests fail on wrong values. Say which is
  which.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass**, then run the full gate list
  (Global constraints).
- [ ] **Step 5: Apply the rule text below, word for word.**

  In `data-integrity.md`, BR-DATA-005: after the bullet that begins
  "**Percentages and larger-unit quantities keep decimals**", add:

  > - **On a chart, money is shortened** (owner decision 2026-09-12: *"hiển thị có đơn vị là k, triệu thì đơn vị là tr"*): "k" for thousands, "tr" for millions, up to two decimals with a comma ("100k", "100,12k", "100tr", "100,12tr"), no space before the unit. One chart uses one unit for every figure it draws: "tr" when at least half of the months with a non-zero profit are a million or more in size, otherwise "k". The owner typed the decimals with a dot; the app writes a comma, because a dot is its thousands mark. Code: `lib/reports/compact-money.ts`.

  In `profit-and-loss.md`, replace the first sentence:

  - Old: "The monthly profit-and-loss page is `/admin/reports/pnl` (menu Báo cáo → Lãi lỗ)."
  - New: "The monthly profit-and-loss page is `/admin/reports/pnl`, named **Báo cáo tài chính** (menu Báo cáo → Báo cáo tài chính; owner decision 2026-09-12, renamed from Lãi lỗ; the route keeps its old name)."

  Then add, after the **Rounding.** paragraph:

  > **How the page shows it** (the sample the owner approved on 2026-09-11, and his notes of the same evening). A cost line — cost of goods, items bought for immediate use, shrinkage, each expense group, depreciation — shows its value with a minus, so the table reads as a sum from top to bottom; that minus is not red, red is kept for a result below zero. A money cell that is exactly zero shows "–". The running total since January is called "Luỹ kế" (owner, 2026-09-11). Notes under the table are numbered, and a month carries the numbers of the notes about it. The chart shortens money as `BR-DATA-005` says.

- [ ] **Step 6: Commit** the four code files, the fixture if it changed, and
  the two rule files, by path:
  `feat(reports): chart figures in k and tr, numbered notes, Luỹ kế (BR-DATA-005)`.

## Mục 2 — Name, font, header, summary figures, chart

**Files:**

- Modify: `app/globals.css`, `tailwind.config.ts`, `app/admin/layout.tsx`
- Modify: `app/admin/finance/categories/components/CategoryForm.tsx`, the
  sentence "Trang Lãi lỗ cộng vào dòng Doanh thu thay vì Thu khác." becomes
  "Trang Báo cáo tài chính cộng vào dòng Doanh thu thay vì Thu khác."
- Modify: `app/admin/reports/pnl/actions.ts` and its test,
  `app/admin/reports/pnl/page.tsx`
- Replace: `app/admin/reports/pnl/components/YearPicker.tsx` with
  `YearSelect.tsx`, a client component
- Modify: `PnlSummary.tsx` and its test, `PnlChart.tsx`
- Create: `PnlChart.test.tsx`

**Steps:**

- **Font.**
  - In `app/globals.css`, add after `@tailwind utilities;`:

    ```css
    @layer base {
      h1, h2, h3 { font-family: 'Outfit', 'Plus Jakarta Sans', Arial, Helvetica, sans-serif; }
    }
    ```

  - Add to `:root`: `--color-chart-profit: #6B9E80;`.
  - In `tailwind.config.ts`, `extend`:
    - `fontFamily.display: ["Outfit", "Plus Jakarta Sans", "Arial", "sans-serif"]`;
    - `colors["chart-profit"]: "var(--color-chart-profit)"`;
    - `boxShadow.panel: "0 1px 2px rgba(29,42,36,.06), 0 6px 24px rgba(29,42,36,.05)"`.
- **Menu.** Change `{ name: "Lãi lỗ", href: "/admin/reports/pnl" }` to
  `name: "Báo cáo tài chính"`.
- **Action.** `getProfitAndLossReport` also returns `brandNames: string[]`,
  read with `findAll("Brands")`, ordered by `code`, holding each `name`. It is
  read in the same `Promise.all`.
- **Page header.**
  - `h1` "Báo cáo tài chính" (`text-2xl md:text-[28px] font-bold`).
  - Under it, a subtitle: `Cả quán, gồm {names} · đơn vị: đồng · tháng theo
    giờ Việt Nam`.
    - Names are joined as "A và B" for two, and "A, B và C" for more.
    - With no brand, the subtitle reads "Cả quán · đơn vị: đồng · tháng theo
      giờ Việt Nam".
  - At the right, `YearSelect`:
    - a `<label>` "Năm" (uppercase, 12px, muted) and a `<select id="pnl-year">`;
    - `onChange` does `router.push("/admin/reports/pnl?year=" + value)`;
    - it is shown even with one year.
  - The header is a `flex flex-wrap items-end justify-between`. Delete
    `YearPicker.tsx`.
- **`PnlSummary`.**
  - The tiles are as in "Bản thử, tóm tắt".
  - The values use `font-display text-2xl font-semibold`.
  - The section is `hidden md:grid md:grid-cols-2`, adding `lg:grid-cols-4`
    when there is a worst month and `lg:grid-cols-3` when there is not.
  - The tiles and their sub-lines are in the table under "Ví dụ bằng số thật".
    - The period sub-line is `từ {months[0].title} đến {end}`. The end is
      `{last.until}/{year}` when the last month has an `until`, otherwise
      `last.title`.
    - When the margin is null, the net sub-line is "chưa có doanh thu".
    - The best-month tile has no month when no month made a profit: its
      value is "---" and its sub-line "Chưa có tháng nào lời".
    - The worst-month sub-line adds ` · xem ghi chú {numbers joined by ", "}`
      when that month's `notes` is not empty.
- **`PnlChart`.**
  - The section is
    `hidden md:block rounded-xl border border-border bg-surface-card shadow-panel`.
  - Its header row has the `h2` "Lãi lỗ từng tháng và luỹ kế" at the left.
    The legend is at the right: "Tháng lời" with a `chart-profit` swatch,
    "Tháng lỗ" with a `danger` swatch, and "Luỹ kế" with a `success` line.
  - The SVG has a fixed `viewBox="0 0 760 280"` and `w-full h-auto`. Its
    margins are left 56, right 18, top 18 and bottom 34.
    - The months are spread across the full width. This fixes the chart that
      used only the middle of a wide screen.
    - Each bar is `min(40, band × 0.46)` wide.
  - **One scale** places the bars, the line, the ticks and the labels.
    - The unit is `pickCompactUnit(chart.map(p => p.netProfit))`.
    - The step is the smallest of {1, 2, 2,5, 5} × 10ⁿ đồng at or above
      (max − min) ÷ 6, where max and min cover the net profits, the luỹ kế
      and 0.
    - The ticks run from `floor(min/step)·step` to `ceil(max/step)·step`.
      Each tick has a faint grid line and a label `formatCompact(tick, unit)`.
      The zero line is darker.
  - **Bar labels.** Each bar has the label `formatCompact(netProfit, unit)`:
    above a profit bar in `success`, and below a loss bar in `danger`. It is
    11px, weight 600, and omitted when the net profit is 0.
  - **Month labels.** `head` goes under each bar, with `*` added when
    `partial`.
  - **Luỹ kế line.**
    - A `success` polyline, 2.5 wide.
    - The points are circles with `fill` from `surface-card` and a `success`
      stroke, 2 wide. They have r 3.2, and the last one r 5.
    - The last point has the label `luỹ kế {formatCompact(cumulative, unit)}`
      beside it, `success`, bold.
  - Keep a `<title>` per month for the hover text, with "luỹ kế" in place of
    "cộng dồn".
- **Tests.**
  - `PnlChart.test.tsx` renders the fixture and asserts:
    - the bar labels and the tick labels all end in the same unit;
    - the loss month's label begins with "-";
    - the section's heading is "Lãi lỗ từng tháng và luỹ kế".
  - `PnlSummary.test.tsx`:
    - the worst-month tile shows the month title as its value;
    - it shows "xem ghi chú" when that month has a note.
  - `actions.test.ts` checks `brandNames`.
- **Commit:**
  `feat(reports): Báo cáo tài chính header, headings in Outfit, chart in k and tr`.

## Mục 3 — Table on a computer, cards on a phone, notes

**Files:**

- Create: `app/admin/reports/pnl/components/pnl-display.tsx`, holding the
  shared display helpers below, and its test
- Create: `PnlNotes.tsx`
- Modify: `PnlTableView.tsx` and its test, `PnlMonthCards.tsx` and its test,
  `PnlSourceList.tsx`, `page.tsx`
- Delete: `PnlFootnotes.tsx`

**`pnl-display.tsx` exports:**

```ts
export function isCostRow(row: PnlRow): boolean;                 // kind "cost" or "expense"
export function shownMoney(row: PnlRow, value: number): number;  // cost rows negated; 0 stays 0 (no -0)
export function cellText(row: PnlRow, value: number | null): string; // percent → formatPercent; money 0 → "–"; else formatNumber(shownMoney)
export function cellTone(row: PnlRow, value: number | null): string; // "text-danger" when the shown value < 0 and !isCostRow(row), else ""
export function NoteMarks({ numbers }: { numbers: number[] }): JSX.Element | null; // <sup> ochre bold 10.5px, numbers joined ","
```

**`PnlNotes`** takes `{ footnotes: PnlFootnote[] }` and renders nothing when
the list is empty. Otherwise it renders a `section aria-label="Ghi chú"`
holding one `<p>` per note:

- the note starts with `<NoteMarks numbers={[n.number]} />`;
- then comes `text`, with every `strong` substring in `font-bold text-primary`;
- the text is `text-[13px] text-text-secondary`.

**`PnlTableView`:**

- **Panel.** The whole section is
  `hidden md:block rounded-xl border border-border bg-surface-card shadow-panel`,
  and contains the table, the detail box and the notes.
- **Panel header.**
  - `h2` "Bảng từng tháng".
  - Hint: "Bấm vào một ô để xem số đó từ đâu ra. Đọc từ trên xuống: doanh thu
    → trừ giá vốn → lợi nhuận gộp → trừ chi phí → lợi nhuận ròng."
  - The unit is now in the page subtitle. Change the old test's "Đơn vị:
    đồng" assertion to look for the new hint.
- **Month header.**
  - Each month shows `head` and `<NoteMarks numbers={notes} />`. When `until`
    is set, a second line reads `đến {until}` in 11.5px muted.
  - The `<th>` keeps an accessible name equal to `label`: add
    `aria-label={label}`. The existing test "09/2026 (đến 11/09)" keeps
    passing.
- **Sticky columns.**
  - The % column is `sticky right-0 w-24 min-w-[6rem]`.
  - The Tổng column is `sticky right-24`, with `border-l-2 border-border`.
  - Both use the row's background: `bg-surface-card`, or
    `bg-surface-secondary` on the profit rows. The header cells do the same.
- **Row styles** follow the sample:
  - The profit rows (subtotal, net) are `bg-surface-secondary font-bold`.
  - The detail row is muted, 12.5px, with `pl-6` on its label.
  - The margin row is muted, 12.5px.
- **Cells** use `cellText` and `cellTone`. The Tổng cell does too; the %
  cell uses `formatPercent`.
- **Selected cell:** `outline outline-2 outline-primary -outline-offset-2
  bg-primary-soft`.
- **Detail box.**
  - It sits inside the panel, under the table, in a `max-w-xl` rounded
    bordered box.
  - Its heading is `{row.label} · {column.label}` followed by
    `cellText(row, value)`.
  - It keeps the formula, the source list and "Đóng".
- **Source list.** `PnlSourceList` takes a `negate?: boolean` prop.
  `PnlTableView` passes `isCostRow(row)`, so a cost cell's rows show with a
  minus.
- **Notes.** `<PnlNotes footnotes={table.footnotes} />` sits at the bottom
  of the panel.

**`PnlMonthCards`:**

- **Section.** `md:hidden`. The hint reads "Bấm vào một tháng để xem từng
  khoản."
- **Year card.**
  - A `<details>`, closed by default,
    `rounded-xl bg-surface-secondary`, with no border.
  - Its `<summary>` reads:
    - eyebrow `TỪ ĐẦU NĂM`, or `CẢ NĂM {year}` for a past year;
    - row 1: "Lợi nhuận ròng" (`font-display`, semibold), with the net total
      in `font-display text-xl font-semibold`, `text-success` when 0 or more
      and `text-danger` below 0;
    - row 2: "Doanh thu" and the revenue total, `text-sm text-text-secondary`.
  - Opened, it lists every row with a total, using `cellText` and `cellTone`.
- **Month card.** The `<summary>` has two rows:
  - row 1: `{title}<NoteMarks numbers={notes}/>`, and the net figure in
    `font-display text-xl font-semibold`, success or danger;
  - row 2: "Doanh thu" (with ` · đến {until}` added when set), and the
    revenue figure, `text-sm text-text-secondary`.
  - Every line inside uses `cellText` and `cellTone`. Its source list gets
    `negate={isCostRow(row)}`.
- **Notes.** `<PnlNotes footnotes={table.footnotes} />` sits under the last
  card.

**`page.tsx`:** remove `PnlFootnotes`. The notes now render inside
`PnlTableView` (computer) and `PnlMonthCards` (phone); each copy is hidden on
the other device.

**Tests to add or change** (red first, then green):

- **`pnl-display`:**
  - a cost row's 46.418.990 shows "-46.418.990" with no red class;
  - a net row's -32.372.964 shows red;
  - 0 shows "–";
  - a margin of null shows "---".
- **`PnlTableView`:**
  - the 08/2026 header shows the note number the fixture gives it;
  - the Vận hành 08/2026 detail rows each contain "-";
  - the Luỹ kế row exists;
  - the notes render inside the table section.
- **`PnlMonthCards`:**
  - the year card is not `open` and its summary contains "Doanh thu";
  - the August card's summary shows the revenue figure;
  - `titles[1]` now contains "09/2026" and "đến 11/09" instead of
    "09/2026 (đến 11/09)".

**Commit:**
`feat(reports): Báo cáo tài chính table and phone cards follow the approved sample`.

After Mục 3, the reviewer, not the implementer, renders the page at
1280 px and 390 px wide and compares it with the two sample screenshots.

## Thứ tự ra máy chủ

No migration. One push, after all three Mục pass review, with the owner's
separate approval. Then the owner opens:

- Báo cáo → Báo cáo tài chính, on a computer and on a phone;
- the POS, to check the product names in the new heading font;
- any other screen he uses often, since every heading changes font.
