# Nền tảng bước 1: nâng cấp Next 14.2 → 16.4, React 18 → 19.3

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng dụng chạy trên Next 16.4.1 và React 19.3.1, mọi nút như cũ, năm cửa kiểm xanh, không nhanh hơn thì cũng không chậm hơn.

**Architecture:** Cài bản mới, chạy codemod chính thức cho 101 trang nhận `params`/`searchParams`, sửa tay vài chỗ còn lại (đổi tên middleware, cấu hình, 44 chỗ làm mới cache, 57 file kiểu `JSX.Element`). Không bật React Compiler, không bật Cache Components, không đổi cách đọc dữ liệu.

**Tech Stack:** Next 16.4.1 (Turbopack mặc định), React 19.3.1, @types/react 19, eslint 9 flat config + eslint-config-next 16.4.1, next-auth 4.24.14 giữ nguyên.

**Spec:** `docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md`, mục 1. Chủ quán chốt thứ tự A ngày 2026-10-15.

## Global Constraints

- Không migration, không đụng dữ liệu, không đổi chữ nào chủ quán thấy (trừ trang Xoá bộ nhớ đệm, mục G1).
- Ponytail: không viết thừa; không thêm thư viện; không bật tính năng mới của Next chỉ vì có.
- Dev chỉ ở cổng 8386. Build ở thư mục chính được vì dev không chạy; nếu dev đang chạy thì build trong worktree.
- Năm cửa kiểm: `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- Đẩy và deploy phải chủ quán duyệt riêng.

## Hiện trạng

Đo 2026-10-15 trên `feat/no-popups` (`0b13998f`), máy chủ dev 8386 không chạy, Vercel chạy Node 24.x, deploy mới nhất READY.

1. **Trạng thái.** Không áp dụng, vì không thêm thứ gì có trạng thái.
2. **Nút.** Không thêm, không bớt nút. Một nút đổi cách chạy: trang Xoá bộ nhớ đệm hiện làm mới ngay khi mở trang (gọi `revalidateTag` lúc vẽ trang); Next 16 không cho làm mới cache lúc vẽ, nên trang có một nút "Làm mới" gọi server action. Chữ trên trang sửa theo (bỏ câu nhắc Google Sheets, đã hết dùng).
3. **Danh sách.** Không áp dụng, vì không danh sách nào đổi nội dung.
4. **Ô nhập.** Không áp dụng, vì không có ô nhập mới.
5. **Dữ liệu.** Không đọc, không ghi dữ liệu mới. Cách làm mới cache đổi: hôm nay `revalidateTag(tag)` trong server action xoá cache ngay; Next 16 bỏ dạng một đối số (lỗi TypeScript). Tài liệu `revalidateTag` (nextjs.org, 2026-08-25) nói dạng một đối số "Behaves like `{ expire: 0 }`", nên **đổi sang `revalidateTag(tag, { expire: 0 })`**, giữ đúng cách chạy hôm nay (phản biện f5, xem mục cuối). 44 chỗ gọi: 41 trong server action và helper `touchRevalidate` của `lib/db/tables.ts`; 3 trong trang Xoá bộ nhớ đệm → chuyển vào action (G1); 2 trong `app/api/revalidate/route.ts` → file chết, xoá.

Câu hỏi riêng cho việc này:

- **Có làm quầy ngừng nhận đơn không?** Có thể, nếu bản mới hỏng ở máy bán hàng. Đỡ: phép thử `app/pos/components/POSScreen.offline.test.tsx` và `app/pos/actions.*.test.ts` phải xanh; mở máy bán trên `next start -p 8386` sau nâng cấp, thêm món, kiểm đơn chờ offline; quay lại bản cũ trên Vercel trong một phút nếu hỏng. **Không có bản preview dùng được:** đo 2026-10-15, ba biến `SUPABASE_*` trên Vercel chỉ đặt cho production, nên preview không nối được cơ sở dữ liệu; kiểm bằng `next start` ở máy (cùng cơ sở dữ liệu thật) thay cho preview.
- **Lúc đẩy.** Trang máy bán đang mở giữ code cũ; sau deploy, nút gửi đơn của trang cũ gọi server action theo mã của bản cũ, máy chủ mới không nhận ra. Chỉ đẩy khi máy bán không còn đơn chờ gửi, và báo nhân viên tải lại trang máy bán ngay sau deploy.
- **Giờ Sài Gòn còn đúng không?** `next.config.js` đặt `process.env.TZ`, nhưng trên Vercel dòng đó không áp: không có biến `TZ` trên Vercel (đo 2026-10-15) và code đã viết cho máy chủ chạy giờ UTC (`app/admin/reports/sales-actions.ts:239`, `lib/shared/report-time.ts:89`); 17 file đặt múi giờ tường minh. Dòng đó chỉ ảnh hưởng máy dev. Kiểm: trang một đơn hàng hiện giờ tạo bằng `created_at` trong bảng cộng 7 giờ, trên `next start` và trên bản thật sau deploy; `scripts/verify-dashboard-seven-days.ts` 0 lệch.
- **Cache đọc dữ liệu còn chạy không?** `lib/db/tables.ts` dùng `unstable_cache` với tag `sheets-<Bảng>`; Next 16 vẫn có `unstable_cache` (đánh dấu "replaced by `use cache`", không bỏ). Tài liệu `unstable_cache` 16.4 chỉ nói tag được xoá bằng `revalidateTag()`/`revalidatePath()`, không nhắc `updateTag`: thêm một lý do giữ `revalidateTag`. Kiểm: `lib/db/tables.test.ts` xanh; sau khi lưu một món trên 8386, danh sách Món hiện món đó ngay.
- **108 trang đặt `dynamic = "force-dynamic"`**, nên việc Next 15 thôi cache `fetch` mặc định không đổi gì ở các trang này.
- **Kiểu `JSX.Element` ở 57 file.** @types/react 19 bỏ namespace `JSX` toàn cục; đổi thành `React.JSX.Element` hoặc bỏ chú thích kiểu trả về. Chọn: bỏ chú thích (ngắn nhất, TypeScript tự suy), trừ chỗ hàm không có return rõ.
- **Cuộn trang.** `app/globals.css:138` đã ép `scroll-behavior: auto`, nên thay đổi cuộn của Next 16 không ảnh hưởng.
- **`next build` không còn chạy lint.** Lint không nằm trong năm cửa kiểm; giữ `npm run lint` chạy được, không thêm cửa.

Ví dụ bằng số thật: không áp dụng, không đụng dữ liệu. Mốc đo thay cho ví dụ: thời gian `npm run build` trước và sau; thời gian mở 5 trang (Tổng quan, Đơn hàng, Phiếu nhập, Doanh số, máy bán hàng) trên `next start -p 8386` trước và sau, đọc `performance.getEntriesByType('navigation')[0].duration`, mỗi trang 3 lần lấy giữa.

Đã xem: `package.json`, `next.config.js`, `middleware.ts`, `.eslintrc.json`, `vitest.config.ts`, `vitest.setup.ts`, `app/layout.tsx`, `app/globals.css`, `lib/db/tables.ts` (findAll, findSoldModifierIds, touchRevalidate), `app/admin/clear-cache/page.tsx`, `app/api/revalidate/route.ts`, `.husky/pre-commit`, hướng dẫn nâng cấp 15 và 16 trên nextjs.org (cập nhật 2026-10-02), peer deps của next-auth 4.24.14, react-datepicker 9.1.0, @testing-library/react 16.3.3. Chưa xem: codemod chạy thật; 52 file test mock `next/cache` từng file; `@types/react-datepicker` 6.2 có đụng react-datepicker 9 không (bản 9 tự mang kiểu; nếu `tsc` kêu thì gỡ gói types).

## Review Focus

1. Lưu một món rồi quay về danh sách Món: món mới phải hiện ngay, không đợi 2–30 phút (`{ expire: 0 }`, không phải `'max'`). Phép thử: test action Món kiểm `revalidateTag` được gọi với `("sheets-Products", { expire: 0 })`.
2. Trang có `searchParams` (Đơn hàng lọc theo ngày): bộ lọc trên địa chỉ vẫn áp đúng sau khi `params` thành Promise. Phép thử: test trang có sẵn chạy xanh; mở `/admin/orders?range=THIS_MONTH` trên 8386 thấy đúng tháng.
3. Máy bán hàng mất mạng: đơn chờ vẫn lưu trong IndexedDB và gửi lại. Phép thử: `POSScreen.offline.test.tsx`.
4. Đăng nhập: `middleware.ts` → `proxy.ts`, STAFF vào `/admin` vẫn bị đẩy về `/pos`; chưa đăng nhập vào `/admin` bị đẩy về trang đăng nhập. Kiểm bằng tay trên 8386 với tài khoản STAFF.
5. Script chạy ngoài Next (`CLI_MODE`): `touchRevalidate` gọi `revalidateTag` ngoài request phải nuốt lỗi như hôm nay. Phép thử: `lib/db/tables.test.ts` "bypasses unstable_cache when CLI_MODE is set" và test gọi `insert` khi `revalidateTag` ném lỗi.

---

## Phiếu giao việc

Backend và cấu hình → Sonnet (S1). Trang Xoá bộ nhớ đệm → Gemini (G1, sau S1 vì cần action của S1). Opus đo trước, soát, đo sau, mở trang bằng mắt (O1, O2). Mỗi phiếu mở đầu bằng việc thách thức kế hoạch này; viết theo ponytail.

### O1 (Opus, trước S1): mốc đo — **xong 2026-10-15**

- [x] `npm run build` trên Next 14.2.35: **52 giây**, 119 route.
- [x] `npx next start -p 8386`, đo 5 trang bằng `fetch` có cookie phiên ADMIN, mỗi trang 3 lần lấy giữa (trọn thân trang, không tính vẽ ở trình duyệt): Tổng quan `/admin` **311 ms**; Đơn hàng `/admin/orders?range=THIS_MONTH` **538 ms**; Phiếu nhập `/admin/inventory/purchase-orders` **206 ms**; Doanh số `/admin/reports/sales?range=THIS_MONTH` **978 ms**; máy bán hàng `/pos` **56 ms**. O2 đo lại đúng cách này để so.
- [x] Nhánh `chore/next-16` từ `feat/no-popups` (`29a410bb`), cây làm việc sạch, `node_modules` theo lockfile Next 14.
- Cách đăng nhập để kiểm không cần mật khẩu: tạo cookie `next-auth.session-token` bằng `encode` của `next-auth/jwt` với `NEXTAUTH_SECRET` trong `.env.local`, token `{ sub, id: "USR-001", role: "ADMIN", name }` (USR-001 là tài khoản ADMIN đang hoạt động duy nhất; đo 2026-10-15). Vai STAFF kiểm bằng token giả `id: "USR-TEST-STAFF", role: "STAFF"` chỉ để xem proxy đẩy về `/pos`. Không in token ra màn hình; ghi vào file trong scratchpad rồi đọc từ script hoặc `page.context().addCookies` của Playwright.
- Lưu ý: một lần chạy S1 dang dở đã bị dừng và hoàn tác toàn bộ (103 file codemod, `eslint.config.mjs`, `package.json`); bắt đầu lại từ cây sạch.

### S1 (Sonnet): cài bản mới, codemod, sửa tay, năm cửa kiểm

**Files:**
- Modify: `package.json`, `package-lock.json`, `next.config.js`, `middleware.ts` → `proxy.ts`, `.eslintrc.json` → `eslint.config.mjs`, `lib/db/tables.ts`, 101 file `page.tsx` (codemod), 57 file có `JSX.Element`, các file action có `revalidateTag`, 12 file test so đối số `revalidateTag`.
- Create: `app/admin/clear-cache/actions.ts`.
- Delete: `app/api/revalidate/route.ts` (và thư mục), `googleapis` khỏi `package.json`.

**Interfaces:**
- Produces: `clearProductCache(): Promise<void>` trong `app/admin/clear-cache/actions.ts`, `"use server"`, gọi `revalidateTag(tag, { expire: 0 })` cho `sheets-Product_Variants`, `sheets-Products`, `sheets-Product_Price_History`, yêu cầu `requireAdmin()` như các action khác.

- [x] **Bước 1: cài bản mới**

```bash
npm install next@16.4.1 react@19.3.1 react-dom@19.3.1 @types/react@19 @types/react-dom@19 eslint@9 eslint-config-next@16.4.1
npm uninstall googleapis
```

Nếu `npm install` kêu peer dependency: đọc tên gói kêu, không dùng `--force` khi chưa biết gói nào.

- [x] **Bước 2: codemod**

```bash
npx @next/codemod@canary next-async-request-api .
npx @next/codemod@canary next-lint-to-eslint-cli .
```

Codemod thứ nhất sửa 101 trang; đọc diff, chỗ nào codemod để lại chú thích lỗi hoặc `UnsafeUnwrapped` thì sửa tay thành `await`. Codemod thứ hai đổi `"lint": "next lint"` thành eslint CLI và viết `eslint.config.mjs`; nếu codemod không viết được, viết tay:

```js
import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([...nextVitals, { ignores: [".next/**"] }]);
```

và xoá `.eslintrc.json`.

- [x] **Bước 3: sửa tay cấu hình và đăng nhập**

`next.config.js`: bỏ `swcMinify` và khối `eslint`; giữ `reactStrictMode`, `redirects`, dòng `process.env.TZ`.

```bash
git mv middleware.ts proxy.ts
```

Trong `proxy.ts` đổi tên hàm bên trong `withAuth(function middleware(req)` thành `function proxy(req)`; giữ `export default withAuth(...)` và `config.matcher`.

- [x] **Bước 4: làm mới cache**

Viết test đỏ trước trong `lib/db/tables.test.ts`: `insert` gọi `revalidateTag("sheets-Products", { expire: 0 })`. Chạy, đỏ vì đối số thứ hai thiếu.

`lib/db/tables.ts`: `touchRevalidate` gọi `revalidateTag(getCacheTag(sheetName), { expire: 0 })` trong `try/catch` như cũ.

Mỗi chỗ `revalidateTag(x)`: thêm `, { expire: 0 }`. Mock giữ tên `revalidateTag`, không đổi. Đo 2026-10-15: 26 file test nhắc `revalidateTag` (không phải 52), trong đó 12 file có 38 câu `expect` so đúng đối số; chỉ 38 câu đó thêm `{ expire: 0 }`. Grep kiểm cuối: `grep -rnE "revalidateTag\([^,()]+\)" app lib components` phải ra 0 (không còn lời gọi một đối số).

Vì sao không `updateTag` (phản biện f5): `updateTag` chỉ chạy trong server action và ném lỗi ở nơi khác; trong `touchRevalidate` lỗi đó bị nuốt, nên một lần ghi từ ngoài action sẽ để cache cũ mà không ai biết. Tài liệu `unstable_cache` chỉ hứa xoá tag bằng `revalidateTag`. `{ expire: 0 }` là đúng cách chạy hôm nay, chạy được cả trong route handler, và không phải đổi tên mock.

Tạo `app/admin/clear-cache/actions.ts`:

```ts
"use server";

import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/auth";

export async function clearProductCache(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);
  for (const tag of ["sheets-Product_Variants", "sheets-Products", "sheets-Product_Price_History"]) {
    revalidateTag(tag, { expire: 0 });
  }
}
```

Test đỏ trước: `app/admin/clear-cache/actions.test.ts` kiểm ba tag được gọi và người không phải ADMIN bị từ chối (theo mẫu test của action khác trong `app/admin/`).

Trong `app/admin/clear-cache/page.tsx` tạm bỏ ba dòng `revalidateTag` để `tsc` xanh; G1 dựng lại trang.

Xoá `app/api/revalidate/` (grep: không ai gọi `api/revalidate`).

- [x] **Bước 5: kiểu React 19**

```bash
grep -rln "\bJSX\.Element" app components lib
```

Mỗi chỗ `): JSX.Element {` → `) {`. Chạy `npx tsc --noEmit`; lỗi còn lại sửa từng cái theo nghĩa nhỏ nhất (ví dụ `ReactNode` chặt hơn, `ref` kiểu mới). Nếu lỗi từ `@types/react-datepicker`: `npm uninstall @types/react-datepicker` (react-datepicker 9 tự mang kiểu).

- [x] **Bước 6: năm cửa kiểm**

```bash
npx tsc --noEmit
npx vitest run
npx vite-node scripts/check-rules-current.ts
npx vite-node scripts/doc-checks/run-blocking.ts
npm run build
npm run lint
```

Test đỏ vì React 19 (ví dụ `act` warning thành lỗi, `@testing-library/react` cần `IS_REACT_ACT_ENVIRONMENT`): sửa trong `vitest.setup.ts` một lần, không sửa từng test. `npm run lint` đỏ không chặn, nhưng báo số lỗi.

- [x] **Bước 7: commit**

Một commit `chore(deps): Next 16.4.1 and React 19.3.1 — ...` ghi số trang codemod sửa, số file đổi `updateTag`, số file bỏ `JSX.Element`, mọi lỗi `tsc` phải sửa tay và cách sửa.

Báo lại: số dòng diff; lỗi nào phải sửa tay ngoài danh sách trên; chỗ nào thấy thừa nhưng không xoá.

### G1 (Gemini, sau S1): trang Xoá bộ nhớ đệm có nút

**Files:** `app/admin/clear-cache/page.tsx`, test `app/admin/clear-cache/page.test.tsx`.

- [x] Trang theo khuôn `PageHeader` như hôm nay; dưới tiêu đề một `form` với `action={clearProductCache}` và một `Button` dùng chung "Làm mới bộ nhớ đệm"; sau khi bấm hiện `Alert` loại thành công "Đã làm mới bộ nhớ đệm." (dùng `useActionState` hoặc `useFormStatus` của React 19 cho trạng thái đang chạy). Bỏ câu nhắc Google Sheets. Máy tính và điện thoại cùng một cột vì trang chỉ có một nút; nút rộng vừa ngón cái trên điện thoại.
- [x] Test render: có nút, bấm gọi action một lần.
- [x] Commit.

### O2 (Opus, sau G1): soát, đo sau, mở bằng mắt

- [x] Soát diff S1 và G1: tìm chỗ thừa, chỗ codemod để lại rác, chỗ còn `revalidateTag` một đối số.
- [x] `npm run build` ghi số giây; `next start -p 8386`; đo 5 trang như O1; so sánh, ghi vào kế hoạch chung.
  - Đo 2026-10-15 (giữa 3 lần sau 1 lần làm nóng, ms, trước → sau): Tổng quan 311 → 325; Đơn hàng 538 → 396; Phiếu nhập 206 → 126; Doanh số 978 → 577; `/pos` 56 → 5 (cả hai đo lối chuyển về `/admin` vì thiếu `outletId`, không phải máy bán thật). Dựng 52 s → 36 s (lần đầu), 11–13 s khi có bộ nhớ dựng.
- [x] Mở trên 8386 ở 1568/1024/390 px: Tổng quan, Đơn hàng (lọc `?range=THIS_MONTH`), Phiếu nhập, Doanh số, Món (lưu một món thử rồi ngừng bán nó), Xoá bộ nhớ đệm, máy bán hàng (thêm món, không thanh toán), đăng nhập STAFF vào `/admin` bị đẩy về `/pos`.
  - Làm 2026-10-15: 6 trang quản trị × 3 khổ đều mở được, không tràn ngang; máy bán hàng Điểm bán 1 thêm Cà phê sữa tươi 500ml ra 22.000, không thanh toán; STAFF vào `/admin` bị đẩy về `/pos`; nút Xoá bộ nhớ đệm hiện "Đã làm mới bộ nhớ đệm.". **Không** lưu món thử: ghi vào dữ liệu thật, trái luật không bấm Lưu khi kiểm.
- [x] Kiểm giờ: một đơn hàng, giờ hiện bằng `created_at` + 7.
  - Đơn 261015001032: máy chủ 09:49:29+07, trang hiện 09:49:29.
- [ ] Ghi kết quả vào kế hoạch chung; hỏi chủ quán duyệt đẩy, lúc máy bán không còn đơn chờ. Sau đẩy: báo nhân viên tải lại trang máy bán; Vercel READY, 0 lỗi máy chủ một giờ, chủ quán mở trang thật.

## Phản biện (phiên fnbapp-f5, 2026-10-15, trước khi triển khai)

Đối chiếu với tài liệu nextjs.org: hướng dẫn lên 16 (cập nhật 2026-10-02), `updateTag` (2026-08-18), `revalidateTag` (2026-08-25), `unstable_cache` (16.4.0). Đo lại trên repo và Vercel cùng ngày. Đã sửa thẳng vào các mục trên:

1. **`updateTag` → `revalidateTag(tag, { expire: 0 })`.** `updateTag` ném lỗi ngoài server action và `touchRevalidate` nuốt lỗi, nên hỏng sẽ im lặng. Tài liệu `unstable_cache` không nhắc `updateTag`. `{ expire: 0 }` là cách dạng một đối số đang chạy hôm nay. Đo lại: 0 route handler và 0 trang ghi qua `lib/db/tables.ts` hôm nay, nên đây là phòng xa rẻ, không phải lỗi đang có.
2. **Số file test phải sửa:** 26 file nhắc `revalidateTag`, không phải 52; chỉ 38 câu `expect` trong 12 file phải thêm đối số; mock không đổi tên.
3. **Bỏ bước deploy preview:** biến `SUPABASE_*` chỉ có ở production, preview không có cơ sở dữ liệu. Kiểm bằng `next start` ở máy rồi đẩy thẳng, sẵn sàng quay lại.
4. **Đẩy khi máy bán không còn đơn chờ, báo nhân viên tải lại trang máy bán sau deploy:** trang cũ gọi server action theo mã bản cũ.
5. **`process.env.TZ` trong `next.config.js`:** không áp trên Vercel cả hôm nay; code đã tự tính giờ Sài Gòn. Rủi ro (c) của bản kế hoạch không có ở bản thật; vẫn kiểm giờ một đơn sau deploy.
6. **`proxy.ts`:** chạy Node.js thay vì Edge như `middleware.ts` hôm nay; `withAuth` của next-auth 4.24.14 chạy được trên Node. Không đổi gì thêm.
7. **Thấy thừa, không xoá trong bước này:** biến `GOOGLE_CREDENTIALS_BASE64`, `GOOGLE_SPREADSHEET_ID` trên Vercel không còn ai đọc sau khi gỡ `googleapis`; xoá biến môi trường cần chủ quán duyệt, để bước 2 (dọn code chết).
