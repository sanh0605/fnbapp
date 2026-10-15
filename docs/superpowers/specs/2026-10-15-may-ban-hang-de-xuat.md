# Máy bán hàng and Đăng nhập: area audit and proposal

This page covers Kế hoạch A step 7 (`docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`): the till (`app/pos`, `lib/pos`, `public/pos-sw.js`, the Đồng bộ máy bán page `app/admin/pos-sync`) and the login page (`app/login`, `lib/auth`, `proxy.ts`). It follows the owner's choice "Làm lại từng mảng" (2026-10-15), the same as the Bán hàng, Kho, Thu chi and Báo cáo pages. The master plan §7 fixes two things for this area: the till keeps its own layout and is built last, and every rollout here is announced beforehand because it can stop the till taking orders.

Two read-only audits ran on 2026-10-15: an Opus subagent read every non-test file in the folders above; a Haiku pass then re-opened each cited line (24 claims, 22 held, 2 corrected below); SQL ran against the live server through the management API. Every number below was measured that day. Re-measure before use.

Owner instruction the same day: *"Tạm làm tất cả theo em khuyến nghị, rồi tất cả những gì em đã khuyến nghị thì tổng hợp lại cho anh khi có kết quả cuối."* Every open design choice below takes the recommendation and is marked "chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15". Two things were not covered by that authorisation and were asked the same day: Q1, selling without internet, answered *"Không bán khi mất mạng"* (`BR-SALE-015`, closes `BR-U-001`); Q2, one account per cashier, answered *"Mỗi thu ngân một tài khoản"* (`BR-SALE-016`, one row of `BR-U-003`). Pushes still need his yes each time; this area has two migrations (drop the sync-failure table, add the category icon).

Overlap with f5's in-flight work (`docs/superpowers/specs/2026-10-15-ban-hang-de-xuat.md` C10 and `2026-10-15-tinh-khuyen-mai-design.md`): promotion money, `lib/sales/order-cart.ts`, `lib/sales/price-cart.ts` and the price check `BR-SALE-008` in `app/pos/actions.ts` belong to C10. This page does not redo them; where it touches the same file it says so and C10 goes first.

## Hiện trạng

1. **States.**
   - The cart lives in browser memory only (`POSScreen.tsx`). A draft (Sapo's "lưu tạm") is a row in `POS_Drafts`; it is hard-deleted after checkout without awaiting the result (`POSScreen.tsx:830-835`), which the data rule already allows for till drafts. Any logged-in user can update or delete any draft by id (`actions.ts:258-295`: only `resolveActor()`, no outlet or owner check). Measured: 0 drafts on the server.
   - An order is written COMPLETED in one Postgres function, `create_pos_order_atomic` (`lib/sales/pos-order-transaction.ts:59-61`; f5 checked 2026-10-15 with `pg_get_functiondef`: the wrapper's last definition is migration 0085, the inner `create_pos_order_atomic_unvalidated_0025` is 0121, both live on the server). `docs/03-workflows/sales.md:53-56, 109-110, 122-123` say the opposite ("the web app is not where a completed sale is written", "does not write `orders_v2`"). The doc is wrong; the code is right.
   - Offline: the three pay buttons are disabled when the browser reports no network (`CartPanel.tsx:509, 537, 573`: `!isOnline`), while the banner at `POSScreen.tsx:1065` says *"Mất kết nối — đơn vẫn được lưu, sẽ tự gửi khi có mạng"*. The Enter key (`POSScreen.tsx:951`) ignores the offline flag and runs the same submit path. An order is queued only when the call itself throws (`POSScreen.tsx:866-879`); a server refusal rolls the cart back (`:838-840`). `submitOrderV2` catches every exception and returns `{ success: false }` (`actions.ts:141-142`), so a database hiccup looks like a refusal and is never queued. A replayed queued order is stamped with whoever is logged in at replay time, not at sale time (`actions.ts:47-49, 77`; `order-cart.ts:194-195`). `attemptCount` in the queue is incremented and never read. Measured: 0 rows in the sync-failure table, ever; 0 queued orders.
   - Login: NextAuth JWT, no `maxAge` set (NextAuth default 30 days), role read from the token by `proxy.ts:13-14`; the only rule enforced is STAFF cannot open `/admin`. No rate limit or lockout anywhere (`grep rateLimit|throttle|lockout`: 0 hits in `lib/auth`, `app/login`, `app/api`, `proxy.ts`). Measured: 2 user accounts; 714 completed orders in the last 30 days, all by one account (tuyen2612); 7 voids in 30 days; peak 06–09h.
   - Promotions: the till sends `applied_promotion_id` and never `promo_code` (0 hits in `app/pos`), while the server rejects an id whose promotion has a code unless `promo_code` matches (`order-cart.ts:253-256`). Measured: 2 promotions, both ACTIVE by status, both ended by date (2026-07-15 and 2026-06-30), both without a code, 831 orders used them; no code promotion has ever existed, so nobody has hit this yet. C10 owns the fix (the till gets a code box, the server auto-applies only no-code promotions, `BR-SALE-008`).
2. **Buttons.**
   - Till: category tabs, best-sellers tab, search, per-line edit (`ItemConfigModal`), per-line and whole-order discount, Lưu nháp, TIỀN MẶT, CHUYỂN KHOẢN, Nhiều hình thức (`BR-SALE-013`), Enter = cash. No logout anywhere on the till (`signOut`: 0 hits in `app/pos`). No "Khách đưa / Tiền thừa" step: KiotViet's payment panel has *Khách thanh toán* and *Tiền thừa trả khách* as its first two lines; Toast's check panel does the same for cash. Nothing to print; not asked, not proposed.
   - Retry strip after a failed checkout labels anything that is not "Chuyen khoan" as "Tiền mặt", so a Nhiều hình thức failure reads "Tiền mặt" (`CartPanel.tsx:337`).
   - STAFF loop: `/pos` without a valid outlet redirects to `/admin` (`app/pos/page.tsx:34-35`), `proxy.ts` sends STAFF on `/admin` back to `/pos`, so a STAFF login (`login/page.tsx:38-39` pushes `/pos` with no outlet) spins. Not hit today: both accounts are ADMIN/MANAGER.
   - Login page shows the raw NextAuth string on failure (`login/page.tsx:30`: "CredentialsSignin"), carries hard-coded "Phin Đi", "Hệ thống Quản lý F&B V2", "Powered by Next.js & Supabase" (`:56-57, :116`) against `BR-UI-001` and the brand table, and ignores `callbackUrl`.
3. **Lists.**
   - Category icons come from a hard-coded keyword table (`lib/pos/pos-category-icons.ts:11-13`): "trà" is matched before "trà sữa", so Trà sữa shows the tea cup. Against the owner's no-hardcode rule (2026-09-28).
   - Search is `toLowerCase().includes` with no accent stripping (`POSScreen.tsx:290-291`): "bac xiu" does not find Bạc xỉu. KiotViet and Sapo both match without accents.
   - Empty state says "Không tìm thấy sản phẩm nào / Thử tìm kiếm với từ khóa khác" even on an empty best-sellers tab (`ProductGrid.tsx:134-140`).
   - `outOfStockProductIds` is passed through three files and is always empty (`actions.ts:127-129` disables the badges; `actions.test.ts:88` asserts it is absent). Haiku correction: live prop, dead feature.
4. **Inputs.**
   - Whole-order discount: `type="number" min="0"` but the change handler stores `Number(value)` unclamped (`CartPanel.tsx:444-450`), so a negative or an amount above the subtotal reaches the total. Haiku correction to the first audit: `min` exists, it just does not act. `inputMode`: 0 hits in `app/pos`; three `type="number"` boxes (`CartPanel.tsx:444, 651`, `ItemConfigModal.tsx:166`).
   - Discount math is copied in five client places (`POSScreen.tsx`, `CartPanel.tsx` ×2, `ItemConfigModal.tsx`, `ProductGrid.tsx`); the server has its own copy in `price-cart.ts` (C10's). `POSScreen.tsx:413` defines a `calculateCartBaseTotal` nobody calls; `CartPanel.tsx:98` defines another that is used.
   - Payment method mapping at `POSScreen.tsx:754` and `:792`: `method === "SPLIT" ? "CASH" : "CASH"`.
5. **Data.**
   - Serves: completed orders, drafts, the idempotency token per checkout (`lib/pos/pos-checkout-idempotency.ts`; `summarizePosCheckoutRequestIds` at `:34` is used only by its own test), the sync-failure table (`cart_payload_json` is written by `actions.ts` and read nowhere: 0 reads outside it).
   - Does not serve: table or seat, customer, printing, cash drawer, shifts, stock badges. Outlets carry no opening hours (measured: both NULL), the till does not need them.
   - Order number falls back to outlet code "000" when the outlet has none (`actions.ts:94`); both live outlets have a code.

**Code health.** `POSScreen.tsx` 1,192 lines, `CartPanel.tsx` 690. English on screen: "POS", "(Split Payment)", "PROMO", "F&B V2", raw server errors. Service worker `public/pos-sw.js` caches under one fixed name and never clears old caches (`:9, :15-17`). Loading skeleton has a fixed `w-96` cart column with no `md:` prefix (`app/pos/loading.tsx:20`). Tests: the offline test greps source text; no test for the login page, `proxy.ts`, `CartPanel`, `ProductGrid`, `CartItemRow`.

Seen: every non-test file under `app/pos`, `lib/pos`, `app/login`, `lib/auth`, `proxy.ts`, `public/pos-sw.js`, `app/admin/pos-sync`; migrations 0040, 0047, 0072, 0081, 0085, 0121 for `create_pos_order_atomic`; live tables `orders_v2`, `promotions`, `POS_Drafts`, users, outlets, sync failures. Not seen: `resolveActor` body and the CLI_MODE path; runtime behaviour on a real phone; the Vercel plan's firewall rate-limit availability.

## Verdict

Keep the till's shape: Toast and KiotViet both run group tabs on the left, a check panel on the right, and pay buttons at the bottom, which is what the till has. Keep one-function order writes, the idempotency token, drafts, Nhiều hình thức. Rebuild where the root is wrong:

1. **Offline is a promise the till does not keep.** The banner says orders are saved; the buttons say no; Enter says yes; a database error is filed as a refusal. Three behaviours for one state. Q1 decides which one is true.
2. **The till has no idea who is selling.** One shared account, no logout, 30-day sessions, no per-cashier accounts. Q2 decides whether the owner wants names on orders.
3. **Hard-coded things the owner may want to change**: category icons, brand name on the login page.

## Owner decisions

- **Q1 — Selling without internet** (`BR-U-001`). **Answered 2026-10-15: (a).** (a) *Recommended:* the till does not sell offline; the banner says so ("Mất kết nối — chưa bán được, kiểm tra mạng rồi bấm lại"), Enter and the buttons agree; the queue, the service worker and the Đồng bộ máy bán page go (0 failures and 0 queued orders ever). A transport error while online keeps the cart and shows "Gửi lại" with the same token, so a double send cannot double-write. (b) Real offline selling: queue every order with the cashier's name and the time of sale, replay in order, show a count on the till; needs a sale-time price snapshot that `BR-SALE-008` then checks against "price in force when taken". Several hundred lines and a second source of truth. Cost of (a): a dropped wifi stops sales until it is back. Cost of (b): the C10 price check and the promotion check get a second time axis.
- **Q2 — One account per cashier** (`BR-U-003`). **Answered 2026-10-15: (a).** (a) *Recommended:* yes: STAFF accounts for cashiers, a Đăng xuất button on the till, the order keeps the cashier's name (already stored: `created_by_name`), reports can filter by Nhân viên (the Doanh số filter already exists). Needs the STAFF loop fixed (R6) and the owner to create the accounts in Nhân sự. (b) Keep one shared account: nothing to build, "Nhân viên" on reports stays one name.

## Recommendations

- **R1 — One offline behaviour** (`BR-SALE-015`). remove `lib/pos` queue code, `public/pos-sw.js` and its registration, `app/admin/pos-sync` and the Tổng quan link "Đồng bộ máy bán" (`BR-CASH-009` list), the sync-failure table and `cart_payload_json` (one migration, drop after the page is gone); the till shows the offline banner, disables the buttons and Enter together, and offers "Gửi lại" on a transport error. `submitOrderV2` keeps its catch but returns `{ success:false, retry:true }` for a thrown error and `retry:false` for a rule refusal, so the till knows which message to show. **Rollout warning:** the first load after this deploy unregisters the service worker; the till reloads once. Push outside 06–09h.
- **R2 — Khách đưa / Tiền thừa on cash.** TIỀN MẶT opens a one-line step: Khách đưa (prefilled with the total, quick buttons for round notes), Tiền thừa shown; nothing stored, nothing new in the database. Nhiều hình thức already asks per method. Chọn theo khuyến nghị, chủ quán uỷ quyền 2026-10-15. Source: KiotViet "Thanh toán" panel (Khách thanh toán, Tiền thừa trả khách); Toast cash tender.
- **R3 — Discount boxes.** Clamp on change: 0 ≤ amount ≤ line or order subtotal, percent 0–100; `inputMode="numeric"`; one client helper that calls the same function the server uses (`price-cart.ts`, C10's), deleting the five copies and the dead `calculateCartBaseTotal` in `POSScreen.tsx`. Goes after C10 lands.
- **R4 — Category icon is a field, not a keyword table.** Add `icon` (text, nullable) to the product-category table, edited on the category page (one migration, one input). Delete `lib/pos/pos-category-icons.ts`. Empty icon shows nothing. Chọn theo khuyến nghị: the rule of 2026-09-28 says what the owner may want to change is data with a screen.
- **R5 — Search without accents**, reusing `stripDiacritics` in `lib/shared/duplicate-name-guard.ts:101` (it already handles đ/Đ, which NFD alone misses; f5 2026-10-15); the `BR-UI-016` search box will use the same function. Empty best-sellers tab gets its own line: "Chưa có món bán chạy ở điểm bán này".
- **R6 — Login page**: Vietnamese error ("Sai tên đăng nhập hoặc mật khẩu"), brand name from the brand table, the two English footers removed, `callbackUrl` honoured, STAFF without an outlet sees the outlet picker (`PosOutletPicker` exists) instead of looping. Login throttle: f5 checks whether the Vercel plan's firewall rate-limit rule covers `/api/auth/callback/credentials`; if yes, one rule, no code; if not, a small `login_attempts` table (user, failed count, locked until) checked in `authorize`, 5 failures → 1 minute. Session `maxAge` unchanged (a shift must not log out mid-sale); logout button from Q2.
- **R7 — Drafts scoped to the outlet** (`savePOSDraft`/`deletePOSDraft` check the draft's outlet against the request); hard delete stays (data rule exception). No draft list beyond today's.
- **R8 — Code health**: `docs/03-workflows/sales.md` corrected (the till writes `orders_v2` through `create_pos_order_atomic`); dead code removed (`summarizePosCheckoutRequestIds`, the `outOfStockProductIds` prop and badge path, `"SPLIT" ? "CASH" : "CASH"` → the explicit mapping, the retry-strip label from the real method); English strings replaced (`BR-UI-001`); `POSScreen.tsx` split by responsibility (grid, cart, checkout) only as far as the edits above require, no rewrite; `loading.tsx` column gets `md:`; tests added for the login page, `proxy.ts` and the discount clamp; the offline test replaced by one on the new `retry` flag.
- **Kept as is**: best-sellers tab, Nhiều hình thức, `BR-SALE-008` and promotion checks (C10), order numbering, 30-day session, no printing, no tables or customers.

## Technical work

| Item | Files | Who | Migration |
|---|---|---|---|
| R1 queue removal + retry flag | `app/pos/*`, `lib/pos/*`, `public/pos-sw.js`, `app/admin/pos-sync`, Tổng quan link, `app/pos/actions.ts` | Sonnet (server, removal), Gemini (banner, buttons) | yes: drop sync-failure table and `cart_payload_json`, after the page is gone |
| R2 cash step | `CartPanel.tsx` | Gemini | no |
| R3 discount clamp + one helper | `CartPanel.tsx`, `ItemConfigModal.tsx`, `POSScreen.tsx`, `lib/sales/price-cart.ts` (import only) | Gemini after C10 | no |
| R4 icon field | migration, category page, `ProductGrid.tsx` | Sonnet + Gemini | yes: add column |
| R5 search without accents | `POSScreen.tsx`, `ProductGrid.tsx` (import `stripDiacritics`) | Gemini | no |
| R6 login | `app/login/page.tsx`, `app/pos/page.tsx`, `lib/auth/auth.ts`, `proxy.ts` | Sonnet; Gemini for the page | only if no Vercel rate-limit rule |
| R7 draft scope | `app/pos/actions.ts` | Sonnet | no |
| R8 code health | as listed | Sonnet (server, docs, tests), Gemini (strings, split) | no |
| BR-SALE-016 | Nhân sự accounts by the owner; `CartPanel.tsx` logout | Gemini | no |

Data writes: none. Structure: no new folder under `app/`; no new area under `lib/`. Every job brief says ponytail: no excess code, deletion first.

## Order of work

1. R8 doc fix and dead code (safe, no behaviour change) with R6 login.
2. R1, as one push, announced, outside 06–09h.
3. R5, R7, R4 (icon migration with the category page in the same push).
4. After C10 lands: R3, then R2.
5. Logout button and STAFF accounts (`BR-SALE-016`), after R6; the owner creates the accounts in Nhân sự.
