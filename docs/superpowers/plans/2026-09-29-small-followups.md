# Small follow-ups after the menu release (2026-09-29)

The owner said "Làm 3 việc nhỏ trước" (2026-09-29). This fixes things that already exist, so the design is a short one inside this plan.

Item 1, the POS offline check, is verification only and was done before this plan:
- Built 97254c0 and served it on :3100.
- Opened `/pos?outletId=OUT-001` in the owner's Chrome and reloaded once while online.
- Cache `pos-shell-v1` then held 25 entries: the document, the JS/CSS, and 12 font files.
- Stopped the server; a check with `fetch` failed, confirming it was down.
- Reloaded. The menu rendered from cache: categories, prices, Be Vietnam Pro loaded.
- No order was placed, so nothing was queued to sync into production.
- Not covered: the offline order queue on a real device. The existing `POSScreen.offline.test.tsx` covers it.

## Item 2: component test for PurchaseOrdersClient

### Current state
1. **States.** Draft filters (`useFilterForm`); `fromError`/`toError` ("Ngày không hợp lệ"); `rangeMsg`; `applyRequested`, which defers Enter until the day box has committed its value; `isPending`.
2. **Buttons.**
   - Lọc runs `handleApply`.
   - Xoá lọc resets everything and applies. It is shown only when the URL has a filter or the draft differs from the defaults.
   - Enter applies only from an input or select outside `.react-datepicker`.
3. **List.** Not applicable: the rows come from the server (`getPurchaseOrdersPage`, already tested in `lib/purchasing/purchase-order-list.test.ts`). This item covers only the filter bar.
4. **Inputs.**
   - The day boxes take dd/mm/yyyy. An impossible date such as 31/02/2026 becomes "invalid", shows "Ngày không hợp lệ" under that box, and does not apply.
   - If from is after to, the range banner shows once and the filter does not apply.
   - The search box takes any text.
5. **Data.** Purchase orders only. Stock issue slips and other lists are not covered.

### Tests (new file `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.test.tsx`)
Mock `next/navigation` (`useRouter().replace`, `usePathname` → `/admin/inventory/purchase-orders`, `useSearchParams` → an empty `URLSearchParams`), then render with 0 rows and 2 suppliers.

- **T1** Type `31/02/2026` in Từ ngày and press Enter. "Ngày không hợp lệ" is shown and `replace` is not called.
- **T2** Từ ngày `25/09/2026` and Đến ngày `20/09/2026` (each committed on blur), then click Lọc. "Ngày bắt đầu phải trước ngày kết thúc" appears exactly once and `replace` is not called.
- **T3** (stale Enter) Type `23/09/2026` in Từ ngày and press Enter without blurring first. `replace` is called once with a URL containing `from=2026-09-23`.
- **T4** Type `PO-19` in the search box and press Enter. `replace` is called with `q=PO-19`.
- **T5** With no filters there is no "Xoá lọc". After typing in the search box it appears.

### Proving they bite
The code is already correct, so each test must be shown red against a deliberate break, then the break reverted:
- T3 must fail when `handleKeyDown` calls `handleApply()` directly.
- T1 must fail when the `"invalid"` check is removed.

## Item 3: text colour on brand-brown backgrounds becomes a palette token

### Current state
1. **States.** Not applicable: this is a colour name, not behaviour.
2. **Buttons.** Every button, tab or badge whose class string has `bg-primary` together with `text-white`: 49 matches in 35 files, measured with grep on 2026-09-29. The look does not change; white stays white.
3. **Scope.**
   - Included: class strings containing both `bg-primary` (exact, not `-soft`, `-hover` or `-active`) and `text-white`.
   - Left out: `text-white` on danger, success or other backgrounds. The owner asked only about the brand button; noted as a follow-up, not done.
4. **Inputs.** Not applicable, because there are no inputs.
5. **Data.** Not applicable, because there is no data. Colours are fixed and not owner-editable (owner 2026-09-29, 4ab9e10), so a token is correct and no table is needed.

### Change
- In `app/globals.css`, add `--color-on-primary: #FFFFFF;` and `--color-on-primary-rgb: 255 255 255;`.
- In `tailwind.config.ts`, add `"on-primary": "rgb(var(--color-on-primary-rgb) / <alpha-value>)"`.
- In every class string that has `bg-primary` and `text-white`, change `text-white` to `text-on-primary`.
- In `app/colour-guard.test.ts`, add a test that fails when any quoted class string in `app/` or `components/` `.tsx` (tests excluded) has both `bg-primary` (exact) and `text-white`. Red on the current tree because of 49 offenders: a value failure.

## Who
Both items go to Gemini (`agy --model gemini-3.1-pro-high`), as separate briefs. Opus runs the gates, proves the tests red, reviews and commits.

Seen: PurchaseOrdersClient.tsx, DayInput.tsx, use-filter-form.ts, globals.css, pos-sw.js, app/pos/page.tsx.
Not seen: each of the 35 files one by one. The grep counts stand in for them, and the guard test will name every file that remains.
