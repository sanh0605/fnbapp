# Cấu trúc kho mã cho việc xây dựng lâu dài — đặc tả và thiết kế

**Viết 2026-09-07 bởi Opus 5, theo yêu cầu của chủ quán:** đọc hướng dẫn của
Anthropic, soát lại toàn bộ dự án, đề xuất cấu trúc thư mục và kế hoạch triển
khai cho việc xây dựng lâu dài. Chủ quán chốt cùng ngày: **làm một đợt trọn
(mức 2), Sonnet chạy liên tục theo kế hoạch, Opus chỉ viết kế hoạch.**

Kế hoạch triển khai: `docs/superpowers/plans/2026-09-07-repo-structure.md`.

---

## 0. Cần chủ quán duyệt — duyệt kế hoạch là duyệt cả bảng này

Mỗi dòng là một việc mà luật dự án đòi duyệt riêng (xoá file, đổi cấu hình).
Duyệt kế hoạch tức là duyệt **đúng những dòng dưới đây**, không hơn. Dòng nào
anh gạch thì Sonnet bỏ qua dòng đó và làm phần còn lại.

| # | Việc | Vì sao | Mặc định |
|---|---|---|---|
| D1 | Xoá `docs/generated/architecture.md`, `scripts/system-map/generate-diagram.ts`, `scripts/system-map/build-diagram.ts` (+ test) và phần "diagram" của `npm run gen:docs` | không tài liệu nào trỏ tới, không cửa kiểm nào đọc; vẽ lại đúng dữ liệu đã có trong `system-map.md` | xoá |
| D2 | Xoá `docs/superpowers/specs/2026-09-07-toi-uu-theo-huong-dan-anthropic.md` | đã bị chính bản đánh giá cùng ngày vượt qua và ghi sai ("hook chỉ nhắc") | xoá |
| D3 | Xoá `components/ui/Card.tsx` | 0 file import (đo 2026-09-07) | xoá |
| D4 | Xoá `scripts/migrate-to-sheets.js` và dòng `"migrate"` trong `package.json` | thời Google Sheets; chỉ `package.json` còn nhắc tới | xoá |
| D5 | Bỏ `docs/generated/edge-cases.md` khỏi thiết kế 02/09 (§3.2) bằng một dòng ghi chú, không dựng | máy trích được tên test nhưng không dịch được sang tiếng Việt; chưa ai hỏi thiếu nó | bỏ |
| D6 | Đổi tên `lib/sheets_db.ts` → `lib/db/tables.ts` | tên nhắc tới Google Sheets đã bỏ; tài liệu phải nuôi một mục "bẫy thứ nhất" chỉ để cảnh báo cái tên này | đổi |
| D7 | Bổ sung 3 dòng vào bảng "Khi luật máy toàn cục gọi thứ không có" trong `CLAUDE.md` (Lodash, cách viết hoa tên, câu "sẽ review") | file toàn máy mâu thuẫn với kho; Anthropic: hai luật mâu thuẫn thì máy chọn bừa | thêm 3 dòng (không sửa file toàn máy) |
| D8 | Anh tự sửa tay `.claude/settings.json` ba chỗ (gộp hai khối `ask`; thêm `permissions.deny` cho đọc thư mục rác; đăng ký hook `SessionStart`) — hoặc cấp quyền `Edit(.claude/**)` để Sonnet làm | bộ lọc auto chặn agent ghi vào file này | anh làm tay |

Ngoài bảng này, kế hoạch **không xoá gì, không đổi hành vi gì**.

---

## 1. Hiện trạng — đo 2026-09-07, không lấy từ tài liệu cũ

### 1.1 Số đo

| | |
|---|---:|
| Module trong `lib/` (không kể test) | 61 file, xếp phẳng, 6.744 dòng |
| Test trong `lib/` | 100 file, 9.844 dòng — trong đó **43 file chỉ đọc chữ trong `supabase/migrations/*.sql` hoặc `supabase/functions/`**, không kiểm module nào bên cạnh |
| `components/` | 46 file: `ui/` dùng chung (14), còn lại là màn hình cụ thể (POS 8, món 3, báo cáo 4, kho 2, nhà cung cấp 1) |
| Thư mục `components/` trong `app/` | 19 (mẫu đã có sẵn: màn hình nào giữ component của màn hình đó) |
| Màn hình (`page.tsx`) | 35 |
| Migration | 96; máy chủ thật đã chạy tới `0096` (đo bằng bảng, không đọc `supabase migration list` — lệnh đó chỉ ghi nhận tới `0064`) |
| Test | 1.291/1.291 xanh, 190 file, 8 giây |
| `CLAUDE.md` | 176 dòng (đã cắt từ 365 sáng nay, chưa commit) |
| File đang sửa dở chưa commit | 66 (toàn bộ việc sáng nay) |

### 1.2 Đối chiếu với hướng dẫn Anthropic (đọc 5 trang ngày 2026-09-07)

Trang: `best-practices`, `memory`, `skills`, `large-codebases`, `features-overview`
tại `code.claude.com/docs/en/`.

| Anthropic khuyên | Dự án | Kết luận |
|---|---|---|
| `CLAUDE.md` dưới 200 dòng, chỉ giữ luật máy không tự suy ra được | 176 dòng | đạt; nhưng lần cắt sáng nay làm rơi **4 luật** (§1.3) |
| Cho máy một phép kiểm tự chạy | 5 cửa + 9 cửa tài liệu; pre-commit chạy 3 | đạt hơn mức khuyên |
| Hook để **chặn**, không chỉ nhắc | `block-destructive-sql.sh` thoát mã 2 | đạt — nhưng file này **không nằm trong git** (§1.3) |
| Kho lớn: chia theo vùng, `CLAUDE.md` riêng từng vùng, skill theo vùng | `lib/` phẳng, không có `CLAUDE.md` vùng nào | **chưa** — đây là việc chính của đợt này |
| `permissions.deny` cho `Read` vào build output, vendored code | chưa có; `recovery-snapshots/` (162 file), `coverage/`, `node_modules` của edge function nằm trong cây | chưa |
| Subagent cho việc đọc nhiều file và cho review độc lập | chưa định nghĩa agent nào trong `.claude/agents/` | chưa |
| Code intelligence plugin cho ngôn ngữ có kiểu | chưa cài | ngoài phạm vi đợt này (cài là việc của máy anh, không phải kho mã) |
| Hai luật mâu thuẫn → máy chọn bừa | `C:\Users\Admin\CLAUDE.md` bắt dùng Lodash (kho không cài), đặt tên "CamelCase", nhắc một agent đã bỏ | D7 |

### 1.3 Sai sót tìm thấy khi soát lại việc sáng nay

1. **`.gitignore` bỏ qua `.claude/rules/` và `.claude/hooks/`.** Luật giao diện
   và script chặn SQL chỉ có trên máy này. Clone mới: mỗi lệnh Bash báo lỗi
   "không thấy hook".
2. **Bốn luật rơi khỏi `CLAUDE.md`** mà không phải tường thuật: "năm câu là sàn,
   tự nghĩ bộ câu hỏi cho việc"; "xác nhận ~95% bằng ví dụ cụ thể trước khi viết
   kế hoạch"; "không xoá test mà không nêu lý do"; quyết định 26/08 "không đo tỉ
   lệ thiết bị".
3. **Ba tài liệu nói ngược hiện trạng máy chủ** (đã tra bằng truy vấn bảng):
   `sales.md` BR-SALE-006 ghi "chưa chạy" — `outlets` đang có 2 dòng, đơn đã
   mang `outlet_id`; `catalog.md` BR-CATALOG-002 ghi "chưa chạy" — bảng
   `base_ingredients` và cột `purchased_items.base_ingredient_id` đều không còn;
   `unresolved.md` BR-U-002 ghi "một thương hiệu một quán", BR-U-003 nhắc "Phase
   3" đã xoá.
4. `supabase migration list` chỉ ghi nhận tới `0064`; 32 migration sau chạy
   ngoài công cụ đó. Lệnh này **không phải nguồn hiện trạng** — chưa tài liệu
   nào nói điều này, và bản 02/09 đã vấp đúng bẫy này.
5. `vitest.config.ts` liệt kê 3 file đã xoá trong `coverage.include`.

---

## 2. Mục hiện trạng theo năm câu (bắt buộc của mọi kế hoạch)

1. **Trạng thái:** không áp dụng — đợt này dời file, không có thực thể nghiệp vụ
   nào đổi trạng thái.
2. **Nút:** không áp dụng — không màn hình nào thêm, bớt, hay đổi nút.
3. **Danh sách chứa gì, loại gì:** áp dụng cho *file*. Dời: mọi `lib/*.ts`
   (61 module + test đi kèm), 43 test chỉ đọc SQL/edge function, 32 component
   màn hình cụ thể trong `components/`. **Không dời:** `app/**` (route của
   Next.js — vị trí là hành vi), `supabase/migrations/*.sql` (Supabase CLI đọc
   theo tên), `scripts/**` (đã có cấu trúc), `types/db.ts`, `components/ui/`,
   `components/dev-feedback/`, `lib/__tests__/fixtures.ts`.
4. **Ô nhập:** không áp dụng.
5. **Phục vụ dữ liệu nào:** không đụng dữ liệu. Không migration, không ghi máy
   chủ, không đổi khoá cache (`sheets-<Tên bảng>` giữ nguyên dù file đổi tên).

**Đã xem:** toàn bộ `lib/`, `components/`, `scripts/`, `.claude/`, `docs/`, cấu
hình gốc, ba đặc tả, importer của từng module (đo bằng script), 10 khối
`flow-decl`. **Chưa xem:** ruột từng migration SQL, ruột ba edge function, ruột
`POSScreen.tsx` (1.143 dòng — chỉ đọc phần import).

---

## 3. Thiết kế

### 3.1 Nguyên tắc

1. **Chia theo vùng nghiệp vụ, không theo tầng kỹ thuật.** Vùng lấy từ menu
   quản trị và mười luồng trong `docs/03-workflows/` — cùng một cách gọi tên ở
   menu, tài liệu, và thư mục.
2. **Không đổi hành vi.** Mọi commit của đợt này phải qua 5 cửa với bộ test
   *không sửa nội dung* (chỉ sửa đường dẫn import). Test nào phải đổi nội dung để
   xanh là dấu hiệu dời sai.
3. **Cái gì thuộc một màn hình thì nằm cạnh màn hình đó** — mẫu 19 thư mục
   `app/**/components/` đã có; `components/` chỉ còn thứ dùng chung thật.
4. **Luật của vùng nào nằm trong vùng đó** (`CLAUDE.md` theo thư mục, Anthropic
   `large-codebases`), nạp khi máy mở file trong vùng; `CLAUDE.md` gốc chỉ giữ
   luật áp dụng mọi nơi.
5. **Mỗi luật cấu trúc có một phép kiểm máy** — cùng ethos với các cửa hiện có.

### 3.2 Cây thư mục đích

```text
fnbapp/
  CLAUDE.md                     luật mọi nơi (<200 dòng) + bản đồ vùng 10 dòng
  app/                          route Next.js — KHÔNG đổi, chỉ nhận thêm component
    pos/
      CLAUDE.md                 luật riêng máy bán hàng (offline, idempotent, không trừ kho)
      components/               POSScreen + 7 component POS (từ components/)
    admin/
      products/components/      ProductForm, ToppingsManager, HistoryModal (từ components/)
      reports/components/       SalesFilter, SalesCharts, CategoryPieChart, ProductTable
      inventory/components/     InventoryForms, CategoryForm
      suppliers/components/     SupplierForm
  components/
    ui/                         nguyên thuỷ dùng chung (14 → 13, bỏ Card) + CustomDatePicker, SearchableSelect
    providers/                  SessionProvider, DialogHost
    dev-feedback/               công cụ góp ý (giữ nguyên)
  lib/
    db/        tables.ts (đổi tên từ sheets_db.ts), supabase.ts, shared-actions.ts, backup-restore.ts
    shared/    action-error, datetime, format, dialog, display-rounding, duplicate-name-guard,
               use-filter-form, nav-completeness, client-error-report, report-time
    auth/      auth.ts
    dev-feedback/  ui-feedback-store, ui-feedback-fingerprint
    sales/     order-cart, order-edit-cart, order-edit-transaction, order-math, order-snapshot,
               order-types, void-order-transaction, pos-order-transaction, pos-captured-at,
               sheets-db-v2-edit
    pos/       pos-offline-queue, pos-checkout-idempotency, pos-category-icons
    purchasing/  purchase-order-transaction, purchase-order-edit-gate, purchase-order-write-plan,
               purchase-line-base-quantity, item-purchase-history
    costing/   CLAUDE.md + issue-costing, issue-costing-inputs, purchase-order-cost-allocation,
               purchase-ledger-rebuild
    stock/     manual-issue-transaction, stock-adjustment-transaction, stocktake-transaction,
               stocktake-package-lines, issue-slip-onhand-display, issue-slip-warnings,
               purchased-item-onhand, conversion-countability
    assets/    asset-depreciation, asset-purchase-allocation
    products/  product-save-transaction, product-erase-transaction, recipe-selection, price-history
    catalog/   outlet-code, outlet-hours, unit-lock, unit-delete-restriction
    reports/   issued-value-report, outlet-breakdown-table, report-v2-allocators, daily-digest
    __tests__/fixtures.ts       dữ liệu test dùng chung (giữ)
  tests/                        test KHÔNG có module bên cạnh
    migrations/                 43 test đọc chữ trong supabase/migrations/*.sql
    edge-functions/             drive-backup, drive-backup-handler, user-admin-security-contract
    public/                     pos-sw.test.ts (đọc public/pos-sw.js)
  scripts/
    CLAUDE.md                   luật riêng script: chạy thử mặc định, --apply, mẫu số
    doc-checks/ system-map/ doc-map/ (giữ)  + lib-root-empty.test.ts (cửa mới)
  supabase/
    CLAUDE.md                   luật riêng migration/edge function
    migrations/  functions/     (giữ nguyên)
  .claude/
    agents/reviewer.md          subagent review ngữ cảnh sạch
    rules/ hooks/ skills/ commands/ settings.json   (rules/, hooks/, agents/ vào git)
  docs/                         (cấu trúc giữ; nội dung sửa theo §4)
```

Vùng đặt theo **ai import** (đo 2026-09-07), không theo tên. Ví dụ:
`purchased-item-onhand` chỉ `app/admin/inventory` dùng → `stock/`;
`report-time` được báo cáo, POS, và script cùng dùng → `shared/`;
`pos-captured-at` chỉ `lib/pos-order-transaction` dùng → đi cùng nó vào `sales/`.

### 3.3 Ba ranh giới cứng, có máy canh

| Ranh giới | Phép kiểm |
|---|---|
| `lib/` gốc không chứa file `.ts` nào — module mới phải vào một vùng | `scripts/doc-checks/lib-root-empty.test.ts` (mới) |
| Không module `lib/` nào chỉ được test của nó import | cửa `orphan-modules` (đã có, chạy trên cây đệ quy) |
| Tài liệu luồng khai đúng file thật | cửa `flow-doc-facts` (đã có) — đổi đường dẫn mà quên sửa tài liệu là đỏ |

### 3.4 `CLAUDE.md` theo thư mục — bốn file, nội dung ghi sẵn trong kế hoạch

| File | Chứa gì (chỉ luật riêng vùng đó, không lặp luật gốc) |
|---|---|
| `lib/costing/CLAUDE.md` | giá vốn đo lúc hàng rời kho; làm tròn đo bằng JS; không còn `stock_ledger`; **chưa có script verify giá vốn** — test trong thư mục là phép kiểm duy nhất, không được nới |
| `supabase/CLAUDE.md` | không sửa migration đã chạy; liệt kê trigger trước khi viết; migration đổi kết quả trả về đi cùng code; `migration list` không phải hiện trạng; chạy lên máy chủ phải duyệt riêng |
| `app/pos/CLAUDE.md` | phải chạy offline; checkout idempotent; bán không trừ kho; điểm bán lấy từ URL; việc có thể làm POS ngừng nhận đơn phải báo trước |
| `scripts/CLAUDE.md` | chạy thử mặc định, `--apply` mới ghi; tên cột từ `information_schema`; báo kèm mẫu số; tiền tố tên script quyết định quyền |

### 3.5 `.claude/` — ba việc

1. `.gitignore`: thêm `!.claude/rules/`, `!.claude/hooks/`, `!.claude/agents/`.
2. `.claude/agents/reviewer.md`: subagent review đọc diff và kế hoạch trong
   ngữ cảnh sạch, chỉ báo lỗ hổng đúng/sai, không góp ý phong cách — hiện thực
   hoá luật "không ai tự duyệt việc mình".
3. `.claude/settings.json` (D8, chủ quán làm tay): gộp hai khối `ask`; thêm
   `permissions.deny`: `Read(./recovery-snapshots/**)`, `Read(./coverage/**)`,
   `Read(./supabase/functions/**/node_modules/**)`, `Read(./.next/**)`.
4. Hook `SessionStart` (`.claude/hooks/session-start.sh`, chủ quán chốt
   2026-09-07 thay cho ý xây bộ nhớ CSV/SQLite): đầu mỗi phiên in 10 commit
   gần nhất, số file đang sửa dở, và nội dung `docs/04-operations/OPEN-ITEMS.md`
   — "đã làm đến đâu, còn gì treo" lấy từ git và file máy sinh, không thể cũ.
   Đăng ký hook trong `settings.json` là việc tay của chủ quán (D8).

### 3.6 Cái cố ý KHÔNG làm

- **Không** tạo `src/`, không đổi alias `@/`. Churn không đổi lấy gì.
- **Không** đổi tên module nào ngoài D6. Tên xấu không phải bug.
- **Không** tách `components/POSScreen.tsx` (1.143 dòng). Đáng tách, nhưng là
  việc đổi cấu trúc code có rủi ro hành vi — ghi thành việc treo, làm đợt riêng.
- **Không** thêm cửa kiểm nào ngoài `lib-root-empty`.
- **Không** cài plugin `typescript-lsp` trong kế hoạch — cài là việc trên máy
  anh (`/plugin install typescript-lsp@claude-plugins-official`), không phải
  trong kho mã. Khuyên cài.
- **Không** push, không deploy, không chạy migration.

---

## 4. Tài liệu bị ảnh hưởng và cách sửa

| Tài liệu | Sửa gì |
|---|---|
| `CLAUDE.md` | thêm 4 luật (§1.3.2); thay "Quy ước đường dẫn" bằng "Cấu trúc và đường dẫn" (bản đồ vùng + luật đặt file); thêm 3 dòng bảng D7; giữ dưới 200 dòng |
| `docs/03-workflows/*.md` (6 file khai `lib/`) | khối `files:` đổi đường dẫn — cửa `flow-doc-facts` bắt nếu sót |
| `docs/01-system/SYSTEM-MAP.md` | khối `relations` đổi đường dẫn — cửa `map-drift` bắt nếu sót |
| `docs/01-system/SYSTEM-OVERVIEW.md` | bỏ "Bẫy thứ nhất" (hết bẫy sau D6), giữ "Bẫy thứ hai"; thêm một đoạn "Kho mã chia theo vùng" 6 dòng |
| `docs/02-rules/business-rules/sales.md`, `catalog.md`, `unresolved.md` | sửa ba câu sai hiện trạng (§1.3.3), kèm ngày đo 2026-09-07 |
| `docs/02-rules/business-rules/data-integrity.md` | thêm đoạn quan sát 2026-09-07: `supabase migration list` không phải hiện trạng; cách đo đúng là truy vấn bảng |
| `docs/04-operations/INCIDENT-RESPONSE.md` | đường dẫn `lib/` nếu có |
| `README.md` | bảng thư mục; bỏ "architecture diagram"; thêm `tests/` |
| `docs/superpowers/specs/2026-09-02-project-reset-design.md` | thêm 2 dòng đầu file: trạng thái hồ sơ; `edge-cases.md` bỏ 2026-09-07 (D5) |
| `.claude/rules/ui-devices.md` | `paths:` thêm `components/**/*.tsx` |

Mọi chỗ trỏ `lib/x.ts` trong code, tài liệu, `.claude/` được đổi bằng một script
dời (viết trong kế hoạch), cửa `docs-refs` và `paths-exist` bắt phần sót.

---

## 5. Thứ tự đợt và điều kiện xong

| Đợt | Việc | Xong khi |
|---|---|---|
| 0 | Chốt việc sáng nay: gitignore, 4 luật, 3 tài liệu sai, D1–D5, D7, vitest coverage; **commit toàn bộ 66 file** | 5 cửa xanh, `git status` sạch |
| 1 | Chuẩn bị công cụ dời: script dời, cửa `lib-root-empty` (đỏ trước), vitest `include` thêm `tests/`, `PATH_PREFIXES` thêm `tests/` | cửa mới đỏ đúng lý do "còn file ở gốc" |
| 2 | Dời 47 test sang `tests/` | 1.291 test vẫn xanh, không sửa nội dung test |
| 3 | Dời `lib/` theo vùng, **mỗi vùng một commit** (13 commit), D6 trong commit `db` | mỗi commit 4 cửa nhanh xanh; cuối đợt `npm run build` xanh; `lib-root-empty` xanh |
| 4 | Dời `components/` (một commit), D3 | 4 cửa + build |
| 5 | `CLAUDE.md` gốc + 4 `CLAUDE.md` vùng + `reviewer.md` + hook `SessionStart` + `SYSTEM-OVERVIEW` + `README` | cửa tài liệu xanh; `CLAUDE.md` < 200 dòng; chạy tay hook in ra đúng 4 khối |
| 6 | Kiểm cuối: 5 cửa; `verify-revenue` 0 lệch trên N; `npm run dev` và **chủ quán mở tận mắt** 5 màn hình (POS, phiếu xuất, kiểm kê, báo cáo bán hàng, danh sách món) | anh gật |

Ước lượng: Sonnet chạy liên tục 1–2 ngày. Mỗi đợt kết bằng commit, không push.

---

## 6. Rủi ro và ảnh hưởng chéo — nói trước

- **Khoá cache không đổi.** `getCacheTag` vẫn trả `sheets-<Tên bảng>`; đổi tên
  file không đổi khoá. Không cần xoá cache sau deploy.
- **`"use server"`:** không file `actions.ts` nào dời; component dời vào `app/**`
  không có `"use server"`, Next.js không coi là route vì không có `page.tsx`.
- **`generate.ts` loại trừ theo tên file** (`sheets_db`, `shared-actions`,
  `backup-restore`): phải sửa cùng commit D6, nếu không bản đồ sinh sẽ báo
  "unresolved" giả.
- **Từ "Codex"** không được xuất hiện trong `CLAUDE.md` (cửa `no-retired-agents`)
  — dòng D7 phải viết tránh tên.
- **Git giữ lịch sử qua `git mv`**; `git log --follow` vẫn thấy.
- **Chủ quán nhìn thấy gì thay đổi:** không gì cả. Nếu thấy khác là lỗi.

## 7. Cái tôi chưa tra

1. Chưa chạy thử script dời trên một module thật — kế hoạch bắt Sonnet chạy thử
   trên `lib/format.ts` trước và so `git diff` bằng mắt.
2. Chưa đo thời gian `npm run build` để biết có nên chạy sau mỗi commit hay chỉ
   cuối đợt — kế hoạch chọn cuối đợt, Sonnet đo lần đầu rồi quyết.
3. Chưa đọc ruột `POSScreen.tsx`; chỉ biết nó import gì.
4. Chưa có cách đo "Claude tuân thủ tốt hơn sau khi có `CLAUDE.md` vùng" ngoài
   quan sát — Anthropic cũng chỉ khuyên quan sát.
