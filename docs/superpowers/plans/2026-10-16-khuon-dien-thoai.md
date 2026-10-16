# Khuôn chung trên điện thoại — kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Trên điện thoại, danh sách hiện thành dòng gọn hai tầng thay cho thẻ to.
- Báo cáo số hiện thành bảng gọn, cột đầu đứng yên.
- Màn hình Tạo/Sửa có ô 48 px, chữ to hơn, thanh lưu chung, dòng hàng thu gọn.

Máy tính giữ nguyên.

**Architecture:**
- Một component dùng chung `PhoneRow` (tên, số, dòng phụ, nhãn). `DataList` dùng nó qua prop `phoneRow` thay cho `renderCard`.
- Cỡ 48 px và cỡ chữ đặt một lần trong component chung ở `components/ui/`.
- Mỗi màn hình chỉ khai báo bốn ô của dòng.
- Phép kiểm dạng "danh sách nợ chỉ được rút ngắn" (giống `form-action-bar.guard`) canh tiến độ từng vùng.

**Tech Stack:** Next.js App Router, React, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md`. Đọc kèm `docs/02-rules/business-rules/screens.md` (BR-UI-003, 004, 005, 014, 015, 016, 017) và `.claude/rules/ui-devices.md`.

## Hiện trạng

Chi tiết và số đếm ở mục 1 của spec. Năm câu:

1. **Trạng thái.** Danh sách: xem / đang chọn ("Chọn" ↔ "Xong") / rỗng hai loại / đang tải. Mới thêm:
   - khung lọc trên điện thoại đóng hoặc mở (nút "Bộ lọc", đóng sẵn khi mở trang), chỉ ở trang truyền `search` hoặc `activeCount` và có ô lọc;
   - dòng hàng trong Phiếu nhập và Phiếu xuất thu gọn hoặc mở, mỗi lúc một dòng;
   - phần ô ít dùng của Phiếu nhập đóng hoặc mở; tự mở khi có giá trị.
2. **Nút.**
   - "Tạo" cùng hàng tiêu đề.
   - "Bộ lọc (n)" mở/đóng khung; trong khung có "Lọc" và "Xoá lọc".
   - "Chọn" / "Xong"; thanh "Xoá n dòng đã chọn" dính đáy màn hình trên điện thoại.
   - Bấm cả dòng để mở trang chi tiết.
   - Thùng rác từng dòng **không hiện trên điện thoại**; máy tính giữ.
   - Biểu mẫu: `FormActionBar`. Dòng hàng đang mở có "Xong" và "Xoá dòng"; "Xoá dòng" không hiện khi dòng thu gọn.
3. **Danh sách.** Cùng dòng, cùng lọc, cùng trang như máy tính. Điện thoại hiện 2–4 thông tin mỗi dòng (bảng Task 3); phần còn lại xem ở trang chi tiết.
4. **Ô nhập.** Khoảng giá trị và lời báo lỗi giữ nguyên; chỉ đổi cỡ và cách xếp. Ô số giữ `inputMode`.
5. **Dữ liệu.** Mọi trang trong `app/admin/`. Cố ý không đụng máy bán hàng (`app/pos/`), trang đăng nhập, bố cục máy tính.
6. **Màn hình nào có hai bố cục đang lệch nhau mà kế hoạch này không sửa?** Nhật ký (`ActivityLogClient`) và Lãi lỗ theo tháng (`PnlMonthCards`) chỉ đổi cỡ chữ. Tổng quan chỉ đổi bảng 7 ngày.
7. **Cái gì có thể vỡ trên máy tính?**
   - `ListPageHeader`, `FilterCard`, `Table` và các ô dùng chung đổi lớp. Mọi lớp mới phải có tiền tố `md:` giữ nguyên cỡ máy tính.
   - Task 7 chụp cả 1280 px để so.
8. **Test nào đang khớp giá trị cũ?** `Field.test.tsx` (44 px, nhãn 13 px, gợi ý 12 px), `Button.test.tsx`, `NumberInput.test.tsx`, `IssueSlipClient.test.tsx` (44 px), `DataList.test.tsx` (ô sắp xếp 44 px dòng 514; tổng "3 nhà cung cấp" xuất hiện 2 lần dòng 759–774; chế độ chọn dòng 212–248), `Table.test.tsx` (`TotalCard`). Các test này đổi theo, kèm lý do, trong task gây ra thay đổi.

Đã xem:
- `components/ui/list/DataList.tsx` (phần điện thoại, dòng 555–645);
- `FilterCard.tsx`, `ListPageHeader.tsx`;
- `components/ui/Table.tsx` (đã có `stick="left"`);
- `Field.tsx`, `SearchableSelect.tsx`;
- `components/ui/list-rows.guard.test.ts`, `form-action-bar.guard.test.ts`;
- bản dò của Haiku về 25 thẻ và 25 biểu mẫu. Opus kiểm lại thẻ Phiếu nhập và danh sách nợ của thanh lưu.
- Sonnet phản biện 2026-10-16 (đọc `DataList.test.tsx`, `PurchaseOrderLines.tsx`, `PurchaseOrderForm.tsx`, thẻ của 8 danh sách, cấu trúc các báo cáo; đếm lại 66/36/26/25/19, đều đúng).

Chưa xem:
- `IssueSlipClient.tsx`, `StocktakeEditForm.tsx` bên trong;
- thẻ của 17 danh sách còn lại (chỉ qua bản dò của Haiku);
- giao diện thật ở 390 px.

## Global Constraints

- Phone = dưới 768 px (`md:`). Mọi thay đổi chỉ áp ở điện thoại; lớp máy tính viết `md:` và giữ giá trị cũ (40 px, chữ 14 px, đệm ô bảng `md:px-4 md:py-3`).
- Ô, nút, ô chọn trên điện thoại: `min-h-[48px] md:min-h-[40px]`.
- Chữ:
  - dòng chính 16 px (`text-base`);
  - dòng phụ trong dòng danh sách 14 px (`text-sm text-text-secondary`), tối đa 2 dòng;
  - gợi ý và lỗi dưới ô 13 px (`text-[13px]`);
  - nhãn ô 14 px (`text-sm`);
  - không chữ nào dưới 12 px ngoài `app/pos/`.
- Không chữ đậm trong dòng danh sách (`BR-UI-003`; `font-bold`/`font-semibold` bị `list-rows.guard` đếm).
- Không hộp nổi (`BR-DATA-007`): khung lọc và dòng hàng mở ngay tại chỗ.
- Chữ hiển thị tiếng Việt; code và chú thích tiếng Anh. Viết theo ponytail: không viết thừa code, không thêm tuỳ chọn ngoài kế hoạch.
- Gemini không chạy lệnh và không commit; Opus chạy kiểm tra và commit. Gemini dùng `agy -p "<phiếu>" --model gemini-4-argon-high --mode accept-edits --print-timeout 0` (đo lại `agy models` trước mỗi lần giao). Từ Task 2 phần sửa trở đi: Gemini 4 Argon hết lượt đến khoảng 2026-10-23, chủ quán chọn `gemini-3.8-flash-high` (2026-10-16, *"Gemini 3.8 Flash"*).
- Worktree ở `.worktrees/phone`, nhánh `feat/khuon-dien-thoai`. Build chạy ở thư mục chính sau khi gộp, vì Turbopack 16.4 từ chối junction `node_modules` trong worktree (đo 2026-10-16), và chỉ chạy khi máy chủ 8386 đang tắt.
- `components/ui/OptionGroupPicker.tsx` chỉ máy bán hàng dùng (`app/pos/components/ItemConfigModal.tsx`), nên phép kiểm cỡ để nó ngoài (`TILL_ONLY`).
- Phiếu Gemini chạy song song trong cùng worktree chỉ khi không chung file nào. Ba danh sách nợ (`OWED_CARDS`, `OWED_44`, `OWED_TINY`) **chỉ Opus sửa**, sau khi phiếu xong; phiếu không đụng tới. Kiểm tra chạy khi cả đợt song song đã xong, rồi commit từng phiếu, chỉ stage file của phiếu đó.
- `PhoneRow` không dùng hook, để trang máy chủ (`purchase-orders/[id]/page.tsx`) dùng được.

## Review Focus

1. **Tên rất dài** (nhà cung cấp, món có size dài) phải xuống tối đa 2 dòng, không đẩy số tiền ra khỏi màn hình. Test trong Task 2 dùng tên 80 ký tự.
2. **Danh sách đang lọc mà khung lọc đóng**: người dùng phải thấy đang lọc. Nút ghi "Bộ lọc (n)" khi n > 0 (Task 2).
3. **Chế độ chọn trên điện thoại**: bấm vào dòng là đánh dấu chứ không mở trang, và ô đánh dấu đổi đúng một lần mỗi lần bấm. Dòng không xoá được thì không có ô đánh dấu. Thanh xoá vẫn thấy khi đánh dấu dòng cuối trang (Task 2).
4. **Dòng hàng đang lỗi trong Phiếu nhập** phải tự mở; bấm "Tạo" khi một dòng đang mở vẫn lưu đủ dòng đó; xoá một dòng phía trên dòng đang mở không làm mở nhầm dòng khác (Task 6c).
5. **Máy tính không đổi**: chiều cao 40 px và bảng giữ nguyên. Task 1 có phép kiểm chuỗi lớp; Task 7 so ảnh 1280 px.

---

### Task 1: Phép kiểm canh tiến độ và luật (backend-coder + Opus)

**Files:**
- Create: `components/ui/phone-rows.guard.test.ts`
- Create: `components/ui/phone-size.guard.test.ts`
- Modify: `docs/02-rules/business-rules/screens.md` (Opus: sửa BR-UI-014, thêm BR-UI-018 và BR-UI-019)
- Modify: `.claude/rules/ui-devices.md` (Opus)

**Interfaces:**
- Produces: ba danh sách nợ `OWED_CARDS`, `OWED_44`, `OWED_TINY`. Opus rút ngắn chúng sau mỗi phiếu.

- [ ] **Step 1: Opus sửa luật** (cùng nhánh, cùng commit với test, theo luật "sửa luật và test trong một lần lưu").
  - BR-UI-014: "On a phone a box or button is 48 px". Sửa luôn câu "Text size is unchanged: 14 px" thành: nhãn ô 14 px, gợi ý và lỗi 13 px, chữ trong ô 16 px. Ghi lý do: lời chủ quán 2026-10-16, chọn theo uỷ quyền.
  - BR-UI-018 "Phone lists are two-line rows": tầng 1 tên + số, tầng 2 thông tin phụ (tối đa 2 dòng) + nhãn; không thùng rác từng dòng trên điện thoại, thanh xoá khi chọn dính đáy; tổng là một dải mỏng.
  - BR-UI-019 "Phone reports keep their table": cột đầu đứng yên, kéo ngang; Lãi lỗ theo tháng giữ dạng bấm mở từng tháng.
  - Trong `.claude/rules/ui-devices.md`, thay dòng "Không dùng bảng ngang. Mỗi dòng là một thẻ xếp dọc." bằng hai dòng:
    - "Danh sách: dòng gọn hai tầng (`PhoneRow`)."
    - "Báo cáo số cần so theo cột: bảng gọn, cột đầu đứng yên, kéo ngang."

    Kèm lời chủ quán 2026-10-16.
- [ ] **Step 2: backend-coder viết `phone-rows.guard.test.ts`**

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-018 (chosen on the owner's 2026-10-16 delegation, spec
// docs/superpowers/specs/2026-10-16-khuon-dien-thoai-design.md section 3.1):
// phone lists draw PhoneRow through DataList's phoneRow prop. OWED_CARDS lists
// screens still on renderCard; it may only shrink.

const root = process.cwd();
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
  });
}
const files = sources(join(root, "app", "admin"))
  .map(f => ({ path: relative(root, f).split(sep).join("/"), src: readFileSync(f, "utf8") }))
  .filter(f => /<DataList\b/.test(f.src));

const OWED_CARDS: string[] = [
  // the 25 files listed in Task 3's table, sorted
];

describe("BR-UI-018 phone lists use PhoneRow", () => {
  it("finds the list screens", () => expect(files.length).toBeGreaterThanOrEqual(25));
  it("every list passes phoneRow or is still owed", () => {
    const off = files.filter(f => !/phoneRow=/.test(f.src) && !OWED_CARDS.includes(f.path)).map(f => f.path);
    expect(off).toEqual([]);
  });
  it("owed entries still use renderCard (the list only shrinks)", () => {
    const paid = OWED_CARDS.filter(p => !files.find(f => f.path === p && /renderCard=/.test(f.src)));
    expect(paid).toEqual([]);
  });
});
```

`OWED_CARDS` is the full list of 25 paths from Task 3's table, written out.
- [ ] **Step 3: backend-coder viết `phone-size.guard.test.ts`.**
  - Năm file chung chứa `min-h-[48px] md:min-h-[40px]`: `components/ui/Button.tsx`, `TextInput.tsx`, `Select.tsx`, `NumberInput.tsx`, `SearchableSelect.tsx`.
  - `components/ui/Field.tsx` có nhãn `text-sm` và gợi ý/lỗi `text-[13px]`.
  - Không file `.tsx` nào trong `app/` (trừ `app/pos/`) và `components/` còn chuỗi `min-h-[44px] md:min-h-[40px]`, ngoài danh sách `OWED_44`. Đếm 2026-10-16: 66 chỗ trong 36 file. Bỏ qua file `.test.tsx`.
  - Không file nào ngoài `app/pos/` có `text-[9px]`, `text-[10px]` hay `text-[11px]`, ngoài danh sách `OWED_TINY` (26 file).
  - Mỗi danh sách nợ có thêm phép "file trong danh sách vẫn còn chuỗi đó", để danh sách chỉ được rút ngắn.
- [ ] **Step 4: Chạy để thấy đỏ đúng chỗ.**
  - Chạy: `npx vitest run components/ui/phone-rows.guard.test.ts components/ui/phone-size.guard.test.ts`.
  - Mong đợi: phép "năm file chung có 48 px" và "Field nhãn 14 px, gợi ý 13 px" ĐỎ vì giá trị sai (hôm nay 44 px, nhãn 13 px, gợi ý 12 px). Mọi phép danh sách nợ XANH.
- [ ] **Step 5: Commit cả luật lẫn test.** Hai phép đỏ đánh dấu `it.fails` kèm chú thích "turns green in Task 2". Task 2 bỏ `.fails` **trong cùng commit** làm chúng xanh; để sót thì `it.fails` thành đỏ.

### Task 2: Component chung và hai trang chạy thử (Gemini)

**Files:**
- Create: `components/ui/list/PhoneRow.tsx`, `components/ui/list/PhoneRow.test.tsx`
- Modify:
  - `components/ui/list/DataList.tsx` (phần điện thoại, dòng 555–645, và thanh xoá hàng loạt);
  - `components/ui/list/FilterCard.tsx`;
  - `components/ui/list/ListPageHeader.tsx`;
  - `components/ui/Button.tsx`, `TextInput.tsx`, `Select.tsx`, `NumberInput.tsx`, `SearchableSelect.tsx`, `Field.tsx`;
  - `components/ui/Table.tsx` (đệm ô gọn trên điện thoại);
  - các file chung còn trong `OWED_44`/`OWED_TINY`: `components/ui/` (`DateRangeButton`, `DetailHeader`, `RemoveRecordButton`, `ListPagination` và file khác trong thư mục này), `app/admin/components/AdminSidebar.tsx`, `MoreSheet.tsx`, `PhoneNavBar.tsx` (nhãn menu dưới 11 px → 12 px, giữ nguyên độ đậm hiện có);
  - test đi kèm: `DataList.test.tsx`, `Field.test.tsx`, `Button.test.tsx`, `NumberInput.test.tsx`, `IssueSlipClient.test.tsx` (chỉ chỗ khẳng định 44 px).
- Pilot:
  - `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx`;
  - `app/admin/finance/components/CashBookClient.tsx`.

**Interfaces:**
- Produces:

```ts
// components/ui/list/PhoneRow.tsx — no hooks, usable from server pages
export interface PhoneRowData {
  title: React.ReactNode;   // line 1 left, wraps to 2 lines max
  value?: React.ReactNode;  // line 1 right, tabular, never wraps
  meta?: React.ReactNode;   // line 2 left, wraps to 2 lines max; most important fact first
  badge?: React.ReactNode;  // line 2 right, at most one badge
}
export function PhoneRow(props: PhoneRowData): JSX.Element;

// DataListProps<T>: during migration exactly one of the two is passed
phoneRow?: (row: T) => PhoneRowData;
renderCard?: (row: T) => React.ReactNode; // removed in Task 3e

// FilterCardProps additions (phone only; desktop ignores them)
activeCount?: number;      // toggle reads "Bộ lọc (2)"; 0 or undefined → "Bộ lọc"
search?: React.ReactNode;  // stays visible beside the toggle while folded; desktop renders it first in the filter row
```

Phone fold turns on only when `search` or `activeCount` is passed **and** `children` is non-empty. Every other caller (report filters such as `SalesFilter`) renders exactly as today.

- [ ] **Step 1: Gemini viết test trước** (`PhoneRow.test.tsx`, phần điện thoại trong `DataList.test.tsx`, `FilterCard` test):
  - đủ bốn ô;
  - tên 80 ký tự có `line-clamp-2`, số có `whitespace-nowrap`, `meta` có `line-clamp-2`;
  - không có lớp `font-bold`/`font-semibold`;
  - `DataList` với `phoneRow`: dòng là link tới `getHref`;
  - không có nút "Xoá …" bên trong phần tử điện thoại: lấy phần tử bằng `closest(".md\\:hidden")` (jsdom vẽ cả hai bố cục nên không phân biệt được bằng role); các test thùng rác máy tính giữ nguyên;
  - bấm "Chọn" rồi bấm vào chữ của dòng thì ô `Chọn <tên>` được đánh dấu (`toBeChecked`); bấm lần nữa thì bỏ đánh dấu (đổi đúng một lần mỗi lần bấm);
  - dòng `canRemove=false` không có ô đánh dấu;
  - thanh xoá hàng loạt có lớp `sticky` trên điện thoại;
  - `totals` vẽ thành một dải: sửa test dòng 759–774 khớp chữ `Tổng …: 3 nhà cung cấp` của dải mới;
  - `FilterCard` với `activeCount=2` và `search` có nút "Bộ lọc (2)"; các ô lọc mang lớp `hidden md:…` đến khi bấm (vẫn có trong DOM, nên test các trang khác điền ô lọc theo nhãn vẫn chạy); Enter trong ô tìm vẫn gọi `onApply`; `FilterCard` không có `search`/`activeCount` thì không có nút "Bộ lọc";
  - đổi khẳng định 44 px thành 48 px trong `Button.test`, `NumberInput.test`, `IssueSlipClient.test`, `DataList.test` dòng 514; `Field.test` nhãn `text-sm`, gợi ý `text-[13px]`.
- [ ] **Step 2: Opus chạy test và ghi nhận đỏ.** Lý do đỏ phải là thiếu `PhoneRow`, thiếu prop hay lớp cũ, không phải lỗi cú pháp.
- [ ] **Step 3: Gemini cài đặt.**

```tsx
// PhoneRow.tsx
export function PhoneRow({ title, value, meta, badge }: PhoneRowData) {
  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-base text-text-primary line-clamp-2 break-words">{title}</div>
        {value != null && <div className="shrink-0 text-base text-text-primary tabular-nums whitespace-nowrap">{value}</div>}
      </div>
      {(meta != null || badge != null) && (
        <div className="mt-0.5 flex items-start justify-between gap-3">
          <div className="min-w-0 line-clamp-2 break-words text-sm text-text-secondary">{meta}</div>
          {badge != null && <div className="shrink-0 flex items-center gap-1">{badge}</div>}
        </div>
      )}
    </div>
  );
}
```

Phần điện thoại của `DataList`:

1. Mỗi dòng là `px-4 py-2.5 min-h-[48px]`.
2. Ở chế độ chọn, dòng xoá được là một `<label>` bọc `<input type="checkbox" aria-label="Chọn {name}">` (20 px, bên trái) và `PhoneRow`. Không dùng `<button>` (không lồng ô đánh dấu trong nút, và tránh đổi hai lần). Dòng không xoá được là `<div>` thường. Bỏ dòng chữ "Chọn {name}" hiện ở trên.
3. Bỏ nút thùng rác trên điện thoại (khối `absolute top-2 right-2`). Bỏ luôn `pr-12`.
4. Thanh "Xoá n dòng đã chọn": trên điện thoại `sticky` ở đáy, ngay trên thanh menu dưới (đọc chiều cao trong `app/admin/components/PhoneNavBar.tsx` và cách layout chừa chỗ cho nó; dùng đúng con số đó, kể cả `env(safe-area-inset-bottom)` nếu thanh menu dùng). Máy tính giữ vị trí cũ (`md:static`).
5. Tổng: thay `TotalCard` trên điện thoại bằng

   ```tsx
   <div className="px-4 py-2 bg-primary-soft text-sm text-text-primary tabular-nums">
     {label}: {values}
   </div>
   ```

   Nếu chỉ có một giá trị thì `values` là giá trị đó. Nếu nhiều giá trị thì ghép `"<header> <value>"`, nối bằng " · ".

Các component chung khác:
- `ListPageHeader`: luôn `flex-row items-center justify-between`. Bỏ `w-full` ở khung nút.
- `FilterCard`:
  - `onKeyDown` (Enter = áp dụng) chuyển lên phần tử gốc, để cả ô tìm lẫn các ô lọc đều nhận Enter.
  - Khi gập được (xem điều kiện ở Interfaces): hàng đầu gồm `search` (co giãn) và nút "Bộ lọc"/"Bộ lọc (n)" cao 48 px, `md:hidden`. Khối `children` cùng hai nút "Lọc"/"Xoá lọc" mang lớp `hidden md:flex` (hoặc `md:grid` như hôm nay) khi đóng, bỏ `hidden` khi mở. Ẩn bằng lớp, không bỏ khỏi DOM.
  - Máy tính: `search` hiện ở vị trí đầu hàng lọc, theo `BR-UI-016` ("first in the filter card"); ở Sổ thu chi và Phiếu nhập ô tìm đổi từ thứ hai lên thứ nhất. Không có nút gập.
- Năm ô và nút dùng chung đổi `min-h-[44px]` thành `min-h-[48px]`, giữ `md:min-h-[40px]`. `SearchableSelect` thêm lớp đó cho nút mở và cho từng lựa chọn.
- `Field`: nhãn đổi `text-[13px]` thành `text-sm`; gợi ý và lỗi đổi `text-xs` thành `text-[13px]`.
- `Table`: ô và tiêu đề kiểu thường đổi `px-4 py-3` thành `px-3 py-2 md:px-4 md:py-3`; tiêu đề cột `whitespace-nowrap`. Kiểu `statement` giữ nguyên. Hôm nay bảng không hiện trên điện thoại nên máy tính không đổi.
- Các file chung trong `OWED_44`/`OWED_TINY` (danh sách ở mục Files): 44 → 48 px, chữ 9–11 px → 12 px (nhãn phụ) hoặc 13 px (gợi ý).
- [ ] **Step 4: Gemini chuyển hai trang chạy thử.**
  - Phiếu nhập:

    ```ts
    phoneRow={po => ({
      title: po.supplierName,
      value: `${formatNumber(po.totalAmount)}đ`,
      meta: [po.dateText, po.id, po.paymentLabel].join(" · "),
      badge: renderStatusBadge(po.status),
    })}
    ```

    `sourceName` chỉ còn ở trang chi tiết.
  - Sổ thu chi: theo dòng "Sổ thu chi" ở bảng Task 3.
  - Cả hai trang truyền `activeCount` (số bộ lọc đã áp dụng khác mặc định, đúng những gì "Xoá lọc" sẽ xoá; quyết định sau khi soát 2026-10-16, vì đếm cả mặc định thì trang mới mở đã hiện "Bộ lọc (2)" trong khi "Xoá lọc" không có gì để xoá) và `search` (ô tìm hiện có, chuyển ra khỏi `children`) cho `FilterCard`. Bỏ `className="w-full md:w-auto"` ở nút "Tạo".
- [ ] **Step 5: Opus chạy kiểm tra.**
  - Lệnh: `npx tsc --noEmit`, rồi `npx vitest run components/ui app/admin/inventory/purchase-orders app/admin/inventory/issue-slips app/admin/finance app/admin/components`.
  - Bỏ `.fails` ở Task 1 trong cùng commit.
  - Opus sửa `BR-UI-004` (`screens.md`, câu "as a card on a phone") thành dải mỏng, cùng commit.
  - Xoá hai trang khỏi `OWED_CARDS`, và các file đã sửa khỏi `OWED_44` / `OWED_TINY`.
  - Commit.
- [ ] **Step 6: Soát độc lập** (agent `reviewer`), theo Global Constraints và Review Focus 1–3, 5.

Task 2 phải gộp xong vào nhánh trước khi Task 3–6 bắt đầu.

### Task 3: 23 danh sách còn lại, chia bốn phiếu theo vùng (Gemini, chạy song song)

Phiếu 3a là Kho, 3b Bán hàng, 3c Tài chính, 3d Hệ thống. Mỗi phiếu làm ba việc:
- đổi `renderCard` thành `phoneRow` theo bảng dưới;
- truyền `activeCount`, `search` cho `FilterCard` nếu trang có ô tìm hoặc ô lọc;
- đổi `min-h-[44px]` thành `min-h-[48px]` và chữ 9–11 px lên 12–13 px trong file của vùng mình (kể cả file không có danh sách như `RoleBadge` ở 3d).

Phiếu **không** sửa ba danh sách nợ; Opus sửa sau khi phiếu xong.

Test của từng màn hình mà khớp chữ trong thẻ cũ thì sửa cho khớp dòng mới. Test nào xoá thì nêu lý do.

Quy ước:
- "·" nối các phần của `meta`; phần trống thì bỏ (`.filter(Boolean).join(" · ")`). Cột "—" nghĩa là không có.
- `meta` xuống tối đa 2 dòng; các phần xếp theo thứ tự trong bảng, quan trọng trước.
- `badge` tối đa một nhãn. Nhãn thứ hai (nếu có) chuyển thành chữ trong `meta`.

| Phiếu | File | title | value | meta (theo thứ tự) | badge |
|---|---|---|---|---|---|
| 3a | `app/admin/inventory/assets/components/AssetsClient.tsx` (bỏ `AssetItemCard.tsx` nếu không còn ai dùng) | tên | giá trị còn lại + "đ" | "Còn x / mua y" · "Đã thanh lý z" | "Đã thanh lý hết" |
| 3a | `app/admin/inventory/stock/components/StockOnHandClient.tsx` | tên | tồn + đơn vị (đỏ nếu âm, giữ như cũ) | giá trị · số ngày đủ dùng · phân loại · "Kiểm lần cuối …" hoặc "Chưa kiểm lần nào" | "Ngừng dùng" |
| 3a | `app/admin/inventory/stocktake/components/StocktakeList.tsx` | thời gian (`formatDateTimeFull`) | giá trị lệch | mã · người làm · "Đã đếm a/b" | trạng thái |
| 3a | `app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx` | ngày xuất | giá trị + "đ" | mã · người ghi | loại (Phiếu xuất / Đã huỷ) |
| 3a | `app/admin/inventory/items/components/ItemsClient.tsx` | tên | "Tồn: …" | mã · phân loại | "Ngừng dùng" |
| 3a | `app/admin/inventory/conversions/components/ConversionsClient.tsx` | tên hàng | — | "1 {mua} = {tỷ lệ} {gốc}" · mã · "Chỉ cách mua" | "Ngừng dùng" |
| 3a | `app/admin/inventory/units/components/UnitsClient.tsx` | tên | — | ghi chú (nếu có) | — |
| 3a | `app/admin/inventory/categories/components/CategoriesClient.tsx` | tên | — | mã | đặc tính |
| 3a | `app/admin/inventory/asset-bands/components/BandsClient.tsx` | khoảng đơn giá | "{n} tháng" | mã | — |
| 3b | `app/admin/orders/OrderTable.tsx` | mã đơn (+ " · v{n}" nếu là bản sửa) | khách trả | thời gian · "2x Bạc xỉu (L) + Trân châu, 1x …" (đủ món và tuỳ chọn, cắt ở dòng 2) | phương thức; "Đã huỷ" thay phương thức khi huỷ |
| 3b | `app/admin/products/ProductsClient.tsx` | tên món | — | "S 25,000 · L 30,000" (hoặc "Không có size nào đang bán") · nhóm | trạng thái |
| 3b | `app/admin/products/categories/components/CategoriesClient.tsx` | biểu tượng + tên | "{n} món" | mã · loại món | — |
| 3b | `app/admin/products/types/components/ProductTypesClient.tsx` | tên | — | mã · "Tính là ly: Có/Không" · nhóm món | — |
| 3b | `app/admin/products/modifiers/components/ModifiersClient.tsx` | tên | giá thêm | nhóm · mã · "Bán độc lập: Có/Không" | "Ngừng dùng" |
| 3b | `app/admin/products/modifier-groups/components/ModifierGroupsClient.tsx` | tên nhóm | "{n} món" | "Chọn một/nhiều" · tuỳ chọn | trạng thái |
| 3b | `app/admin/promotions/components/PromotionsClient.tsx` | tên | mức giảm | ngày bắt đầu → kết thúc · thương hiệu · áp dụng | trạng thái |
| 3c | `app/admin/finance/bank-accounts/components/BankAccountsClient.tsx` | tên | — | ngân hàng · số tài khoản | trạng thái |
| 3c | `app/admin/finance/categories/components/CategoriesClient.tsx` | tên | — | Bên · tính vào lãi lỗ | trạng thái |
| 3c | `app/admin/finance/monthly-items/components/MonthlyItemsClient.tsx` | tên khoản | "{n} dòng" | nhóm thu chi | trạng thái |
| 3d | `app/admin/brands/components/BrandsClient.tsx` | tên | — | mã · mã đơn · "Từ …" | — |
| 3d | `app/admin/outlets/components/OutletsClient.tsx` | tên | — | thương hiệu · mã đơn · giờ mở cửa | trạng thái |
| 3d | `app/admin/suppliers/components/SuppliersClient.tsx` | tên | — | mã · điện thoại | "Ngừng hợp tác" |
| 3d | `app/admin/users/components/UsersClient.tsx` | tên đăng nhập | — | mã · "Tạo {ngày}" | vai trò |
| pilot | `app/admin/inventory/purchase-orders/components/PurchaseOrdersClient.tsx` | nhà cung cấp | tổng tiền | ngày · mã · thanh toán | trạng thái |
| pilot | `app/admin/finance/components/CashBookClient.tsx` | nhóm thu chi | số tiền | ngày · ghi chú · tài khoản | Bên (Thu/Chi); "Đã huỷ" thay Bên khi huỷ (dòng huỷ mờ như cũ) |

Thẻ tổng giá trị dính trên cùng ở Tồn kho (`StockOnHandClient.tsx` dòng 204) giữ nguyên, chỉ đổi cỡ chữ nếu dưới 12 px.

Thông tin bị bỏ khỏi dòng điện thoại vẫn có ở trang chi tiết:

| Danh sách | Thông tin bỏ |
|---|---|
| Phiếu nhập | nguồn mua |
| Hàng hoá | các dòng quy đổi |
| Sổ thu chi | mã, cách trả, khoản hằng tháng, người tạo |
| Nhà cung cấp | mã số thuế, địa chỉ |
| Nhóm tuỳ chọn | thứ tự hiện |
| Đơn hàng | lý do huỷ; món thứ ba trở đi khi danh sách món dài quá 2 dòng |

- [ ] **Step 1 (mỗi phiếu): Gemini sửa test của các màn hình trong vùng trước.** Những test khớp chữ thẻ cũ phải khớp dòng mới. Opus chạy test và thấy đỏ vì màn hình còn vẽ thẻ cũ.
- [ ] **Step 2: Gemini chuyển màn hình.**
- [ ] **Step 3: Opus chạy kiểm tra khi cả bốn phiếu đã xong.**
  - Opus rút ba danh sách nợ theo file của từng phiếu.
  - Lệnh: `npx tsc --noEmit`, `npx vitest run app/admin components/ui`.
  - Commit từng phiếu riêng, chỉ stage file của phiếu (danh sách nợ đi cùng commit của phiếu cuối).
- [ ] **Step 4: Phiếu 3e (Gemini, sau khi `OWED_CARDS` rỗng).**
  - Bỏ `renderCard` khỏi `DataListProps`; `phoneRow` thành bắt buộc.
  - Bỏ `TotalCard` và test của nó trong `Table.test.tsx` (lý do: không còn ai dùng).
  - Sửa `DataList.test.tsx`.
  - Đổi phép kiểm thứ ba của `phone-rows.guard` thành "không file nào còn `renderCard`".
- [ ] **Step 5: Soát độc lập cả Task 3.**
- [ ] **Step 6: Build sớm một lần.** Gộp nhánh vào `main` ở máy (chưa đẩy), tắt máy chủ 8386, chạy `npm run build` ở thư mục chính, trả `next-env.d.ts` và `docs/generated/system-map.md` (chỉ khác CRLF) về như cũ. Mục đích: bắt lỗi `"use client"` hay import trước khi Task 4–6 chồng thêm.

### Task 4: Dòng con ở trang chi tiết (Gemini)

**Files** (đủ 13 trang có cặp bảng/thẻ cho dòng con, theo `grep md:hidden` ngày 2026-10-16; không làm trang nào ngoài danh sách này, thấy thêm thì báo):
- Kho:
  - `app/admin/inventory/assets/[id]/components/AssetItemDetailView.tsx`;
  - `app/admin/inventory/items/[id]/components/ItemDetailView.tsx`, `PurchaseHistoryView.tsx`;
  - `app/admin/inventory/purchase-orders/[id]/page.tsx` (trang máy chủ; `PhoneRow` không có hook nên dùng được);
  - `app/admin/inventory/stocktake/[id]/components/StocktakeDetailView.tsx`, `StocktakeCountView.tsx`.
- Bán hàng:
  - `app/admin/orders/[id]/components/OrderDetailView.tsx`;
  - `app/admin/products/[id]/components/ProductDetailView.tsx`;
  - `app/admin/products/categories/[id]/components/ProductCategoryDetailView.tsx`;
  - `app/admin/products/modifier-groups/[id]/components/ModifierGroupDetailView.tsx`;
  - `app/admin/products/types/[id]/components/ProductTypeDetailView.tsx`.
- Khác:
  - `app/admin/promotions/[id]/components/PromotionDetailView.tsx`;
  - `app/admin/suppliers/[id]/components/SupplierDetailView.tsx`.

`CancelStocktakeForm.tsx` và `OrderEditForm.tsx` cũng có `md:hidden` nhưng là biểu mẫu, thuộc Task 6.

**Interfaces:** Consumes `PhoneRow` từ Task 2.

- [ ] **Step 1: Gemini sửa test.** Ví dụ dòng hàng phiếu nhập: tầng 1 "Sữa đặc Ông Thọ" và "380,000đ"; tầng 2 "10 hộp × 38,000đ". Opus chạy để thấy đỏ.
- [ ] **Step 2: Gemini đổi phần `md:hidden` của dòng con sang danh sách `PhoneRow`.**
  - Danh sách là `divide-y` với `px-4 py-2.5`.
  - Dòng nào dẫn đi đâu thì bọc `Link` như hôm nay.
  - `FieldList` đầu trang chỉ đổi cỡ: nhãn 14 px, giá trị 16 px trên điện thoại.
- [ ] **Step 3: Opus chạy kiểm tra, rút danh sách nợ, commit, soát độc lập.**

### Task 5: Báo cáo số thành bảng gọn trên điện thoại (Gemini)

**Files:**
- `app/admin/components/DashboardView.tsx` (bảng 7 ngày, có cột dự báo động);
- `app/admin/reports/sales/components/SalesByDaySection.tsx`, `PaymentBreakdownSection.tsx`, `SalesCharts` (chỉ cỡ chữ);
- `app/admin/reports/sales/OutletBreakdownSection.tsx`, `app/admin/reports/sales/page.tsx` (chỉ cỡ chữ);
- `app/admin/reports/components/ProductTable.tsx` (mỗi size một cột);
- `app/admin/reports/issued/page.tsx` cùng `ItemCard.tsx` (thành bảng) và `EventCard.tsx` (danh sách sự kiện: giữ dạng danh sách, đổi sang `PhoneRow`);
- `app/admin/reports/pnl/components/PnlMonthCards.tsx` (giữ dạng bấm mở từng tháng, chỉ đổi cỡ chữ), `pnl-display.tsx` và `PnlTableView.tsx` (chữ 10.5 / 11.5 px lên 12 px);
- `app/admin/finance/components/CashBookMonthsClient.tsx`.

Mỗi file có test cạnh bên thì sửa test đó.

- [ ] **Step 1: Gemini sửa test.** Trên điện thoại phải có `<table>`; ô đầu mỗi dòng thân bảng là `TableRowHeader` với `stick="left"` (lớp `sticky left-0`). Opus chạy để thấy đỏ.
- [ ] **Step 2: Gemini sửa giao diện.**
  - Bỏ bản thẻ `md:hidden` (trừ `PnlMonthCards` và `EventCard` như trên).
  - Bảng hiện ở mọi bề rộng, dùng bộ `Table` sẵn có (đệm gọn trên điện thoại đã có từ Task 2).
  - Cột đầu: tiêu đề `stick="left"`, thân bảng `TableRowHeader stick="left"`; dòng tổng dưới tiêu đề như máy tính.
  - Biểu đồ giữ nguyên.
  - Không thêm bóng mờ mép bảng; Task 7 xem cột cuối bị cắt có đủ báo còn cột không.
- [ ] **Step 3: Opus chạy kiểm tra, rút danh sách nợ, commit, soát độc lập.** Cùng commit, Opus sửa câu "one card per day on a phone" ở `BR-UI-007` (`screens.md`) và `docs/03-workflows/reports.md`.

### Task 6: Màn hình Tạo và Sửa (Gemini, ba phiếu không chung file, chạy song song)

- **6a. Bán hàng, Hệ thống, Tài chính.** Các biểu mẫu thuộc ba vùng này trong `OWED` của `components/ui/form-action-bar.guard.test.ts`.
  - `FormActionBar` như `ProductForm.tsx` đang dùng. Chữ nút theo BR-UI-015: trang tạo "Tạo" và "Bỏ"; trang sửa "Lưu thay đổi" và "Bỏ thay đổi".
  - Chia phần: Khuyến mãi "Chương trình", "Mức giảm", "Thời gian", "Món áp dụng"; Điểm bán "Thông tin", "Giờ hoạt động". Sổ thu chi (`CashEntryForm`) không chia.
  - Tiêu đề phần cỡ `text-sm text-text-secondary`, không đậm.
  - `OrderEditForm.tsx`: chỉ đổi cỡ (spec 3.3 mục 7).
  - Cũng trong phiếu này, chỉ đổi cỡ 44 → 48 px: `VoidOrderForm.tsx`, `DashboardSettingsForm.tsx`, `app/error.tsx`, `app/global-error.tsx` (phép kiểm siết lại 2026-10-16 bắt thêm `min-h-[44px]` đứng một mình).
- **6b. Kho, trừ ba biểu mẫu của 6c.** Các biểu mẫu Kho còn trong `OWED`, cùng `DisposeAssetForm.tsx`, `purchase-orders/[id]/cancel/page.tsx`, `CancelStocktakeForm.tsx`: `FormActionBar`, 48 px, chữ ≥ 12 px.
- **6c. Phiếu nhập, Phiếu xuất, Sửa kiểm kê: trọn gói** (thanh lưu, chia phần, dòng hàng).
  - Files:
    - `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx`, `PurchaseOrderLines.tsx`, `PurchaseOrderTotals.tsx`;
    - `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx`;
    - `app/admin/inventory/stocktake/[id]/edit/components/StocktakeEditForm.tsx`.
  - Thanh lưu: Phiếu nhập "Tạo"/"Cập nhật & Hoàn thành" và "Lưu nháp"; Phiếu xuất "Ghi phiếu xuất (n dòng)" (hôm nay có hai bản thanh ở dòng 393 và 541; `FormActionBar` thay cả hai, chỉ còn một); Kiểm kê "Lưu".
  - Phiếu nhập chia phần: "Thông tin phiếu", "Hàng nhập", "Thanh toán".
  - Trên điện thoại, mỗi dòng hàng hiện bằng `PhoneRow`. Ví dụ dòng hàng Phiếu nhập:
    - tầng 1: tên hàng bên trái, thành tiền bên phải;
    - tầng 2: "10 hộp × 38,000đ".
  - Bấm vào dòng thì nó mở ngay tại chỗ, hiện các ô đang có cùng nút "Xong" và "Xoá dòng". Nút X tuyệt đối ở góc (`PurchaseOrderLines.tsx` dòng 68) bỏ trên điện thoại, không giữ hai nút xoá.
  - Mỗi lúc chỉ mở một dòng, giữ bằng một biến `openIndex`.
    - Dòng mới thêm mở sẵn.
    - Xoá dòng: xoá dòng đang mở thì `openIndex = null`; xoá dòng phía trên thì `openIndex - 1`.
    - Kiểm lỗi lúc bấm "Tạo" (vòng lặp ở `PurchaseOrderForm.tsx` dòng 230–233, trả lỗi đầu tiên `Dòng i+1: …`): đặt `openIndex = i` tại đó. Dòng đang mở mà có lỗi thì viền `border-danger`. Không thêm kiểu lỗi theo từng dòng.
    - Bản nháp khôi phục (`draft.lines`, dòng 157): mọi dòng thu gọn.
  - Máy tính giữ nguyên lưới thẻ `md:grid-cols-12` như hôm nay.
  - Phiếu nhập: cất "Thuế", "Chiết khấu", "Ghi chú" sau dòng bấm "Thuế, chiết khấu, ghi chú". Phần này tự mở khi có giá trị khác 0 hoặc khác rỗng. Số đo 2026-10-16: 14, 15 và 0 trên 206 phiếu.
  - Sửa kiểm kê trên điện thoại: mỗi dòng là tên + đơn vị bên trái, ô số 48 px rộng 7rem bên phải.
- **Step cho mỗi phiếu.**
  - Gemini sửa hoặc viết test trước. 6c phải có test cho:
    - bấm "Tạo" khi dòng 2 thiếu số lượng thì dòng 2 mở ra;
    - bấm "Tạo" khi một dòng đang mở vẫn gửi đủ số lượng của dòng đó;
    - mở dòng 3, xoá dòng 1, thì dòng đang mở vẫn là dòng hàng cũ (giờ là dòng 2).
  - Opus chạy để thấy đỏ.
  - Gemini cài đặt.
  - Opus chạy kiểm tra, rút `OWED` của thanh lưu và ba danh sách nợ, commit từng phiếu, soát độc lập.
- Cuối Task 6: `OWED` của `form-action-bar.guard`, `OWED_44`, `OWED_TINY` rỗng. File nào còn sót thì Opus giao một phiếu dọn trước Task 7.

### Task 7: Kiểm bằng Playwright trước khi báo chủ quán (Opus)

- [ ] **Step 1: Mở trang.**
  - Gộp nhánh vào `main` ở máy. Chạy đủ năm lệnh kiểm (`npx vitest run` toàn bộ, không chỉ thư mục con), build ở thư mục chính.
  - Bật máy chủ 8386 bằng `npm run dev -- -p 8386`.
  - Đăng nhập bằng cách không đưa mật khẩu hay mã phiên qua lệnh `browser_run_code` (bài học 2026-10-15).
- [ ] **Step 2: Kiểm ở 390 × 844.** Mở:
  - 25 danh sách;
  - 13 trang chi tiết ở Task 4;
  - 8 báo cáo ở Task 5;
  - các trang tạo và sửa ở Task 6.

  Mỗi trang:
  - chụp một ảnh vào `.playwright-mcp/phone/`;
  - đọc lỗi console;
  - đo số dòng lọt màn hình đầu.

  Phiếu nhập phải từ 3–4 dòng lên ít nhất 7. Bảng báo cáo: cột cuối bị mép cắt cho thấy còn cột. Thanh xoá khi chọn (dính đáy) không bị thanh menu dưới hay nút tròn máy bán hàng che; nhãn "Máy bán hàng" 12 px không xuống dòng ở 360 và 390 px.
- [ ] **Step 3: Kiểm ở 1280 × 800.** Mở cùng các trang đó, so với `main` trước nhánh: chiều cao ô 40 px, bảng không đổi.
- [ ] **Step 4: Sửa và kiểm lại.** Lỗi tìm được thì giao Gemini sửa, rồi kiểm lại đúng trang đó.
- [ ] **Step 5: Ghi kết quả.** Ghi vào mục "Đã kiểm" của kế hoạch này, kèm mẫu số, ví dụ "68/68 trang mở được, 0 lỗi console".

### Task 8: Dọn và cập nhật kế hoạch chung (Opus)

- [ ] Cập nhật `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`: ghi đợt điện thoại và danh sách điểm chủ quán cần duyệt (mục 6 của spec).
- [ ] Xoá kế hoạch này khi mọi phần đã đẩy lên.
