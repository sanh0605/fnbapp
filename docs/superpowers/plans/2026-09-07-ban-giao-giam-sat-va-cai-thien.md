# Bàn giao cho phiên Opus kế tiếp — giám sát Sonnet và danh sách cải thiện

**Viết 2026-09-07 bởi Opus 5 (Fable), theo yêu cầu chủ quán:** ghi lại mọi cải
thiện đã tìm thấy trong phiên hôm nay và cách giám sát Sonnet đang chạy kế
hoạch, để chủ quán mở một phiên Opus mới xử lý tiếp. Phiên mới **không viết
code** (vai Opus: đặc tả, kế hoạch, review); Sonnet thực thi.

Đọc trước, theo thứ tự:

1. `docs/superpowers/specs/2026-09-07-cau-truc-kho-ma-lau-dai.md` — thiết kế đã duyệt, §0 là 8 việc chủ quán đã cho phép.
2. `docs/superpowers/plans/2026-09-07-repo-structure.md` — 25 task Sonnet đang chạy.
3. `docs/superpowers/specs/2026-09-07-danh-gia-tung-file-tai-lieu.md` — đánh giá từng file tài liệu (sáng cùng ngày).
4. File này.

---

## 1. Hiện trạng lúc bàn giao

- Commit gốc trước đợt: `d4714f9`. Mọi việc của Sonnet nằm sau mốc này trên `main`.
- Cây đã đo: 1.291/1.291 test xanh, tsc 0 lỗi, 4 cửa tài liệu xanh; `npm run build` chưa đo thời gian (Task 5 đo).
- Máy chủ thật đã chạy migration tới `0096` (đo bằng bảng ngày 2026-09-07). `npx supabase migration list` chỉ ghi tới `0064` — **không dùng lệnh đó làm hiện trạng.**
- Ba việc tay của chủ quán trong `.claude/settings.json` (O1 gộp `ask`, O2 chặn đọc thư mục rác, O3 đăng ký hook `SessionStart`) — hỏi chủ quán đã làm chưa trước khi kết luận gì về hook hay quyền.
- Bộ lọc auto-mode chặn agent ghi `.claude/settings.json`, `.claude/commands/*`, `.claude/hooks/*` không nhất quán. Bị chặn thì **dừng và đưa chữ cho chủ quán dán**, không lách bằng `sed`.

---

## 2. Giám sát Sonnet — kiểm gì, lúc nào, bằng lệnh nào

Nguyên tắc: **không tin báo cáo, chạy lệnh.** Sonnet phải báo "đã soát và sạch" chứ không im lặng; im lặng coi như chưa soát.

### 2.1 Sau Task 0 (phản biện)

Sonnet phải gửi một đoạn tiếng Anh mở đầu "Challenged the plan. Objections: …" có số module đã kiểm. Không có đoạn này → yêu cầu làm Task 0 trước khi nhận bất kỳ commit nào.

### 2.2 Sau mỗi commit (mọi đợt)

```bash
git log --oneline d4714f9..HEAD                 # mỗi task một commit, tiêu đề đúng như kế hoạch
npx tsc --noEmit && npx vitest run 2>&1 | tail -4
npx vite-node scripts/check-rules-current.ts && npx vite-node scripts/doc-checks/run-blocking.ts
```

**Dấu hiệu đỏ, dừng Sonnet ngay:**

| Dấu hiệu | Lệnh phát hiện | Vì sao nghiêm trọng |
|---|---|---|
| Test bị sửa ruột (không chỉ dòng import) | `git diff d4714f9..HEAD -- '*.test.ts' '*.test.tsx' \| grep '^[-+]' \| grep -v '^[-+][-+]' \| grep -v 'import\|from'` → phải **rỗng** | dời sai chỗ rồi bẻ test cho xanh |
| Số test giảm | `npx vitest run 2>&1 \| grep "Tests"` → 1.291 (trừ 1 của build-diagram, cộng 1 của lib-root-empty = 1.291) | xoá test không nêu lý do |
| Xoá ngoài D1–D7 | `git diff --diff-filter=D --name-only d4714f9..HEAD` → chỉ 6 file của Task 4 + `components/ui/Card.tsx` + `scripts/refactor-move.cjs` | luật xoá phải duyệt riêng |
| Gộp nhiều vùng vào một commit | `git show --stat HEAD` | không review nổi, không lùi được từng vùng |
| Đụng `.claude/settings.json`, `supabase/migrations/*.sql`, `.env*` | `git diff --name-only d4714f9..HEAD \| grep -E "settings.json\|migrations/.*\.sql\|\.env"` → rỗng | ngoài phạm vi |
| Push | `git log origin/main..HEAD` phải còn commit; `git status -sb` không hiện "ahead 0" do push | chưa ai duyệt push |

### 2.3 Mốc cuối mỗi đợt

| Đợt | Kiểm thêm |
|---|---|
| 0 | `git status --short` rỗng; `wc -l CLAUDE.md` ≤ 184; `grep -c "Codex\|Antigravity" CLAUDE.md` = 0 |
| 1 | `docs/04-operations/OPEN-ITEMS.md` có đúng một mục (lib-root); `scripts/refactor-move.cjs` tồn tại; `lib/shared/format.ts` đã dời (bằng chứng script chạy) |
| 2 | `ls tests/migrations \| wc -l` = 44; `ls tests/edge-functions \| wc -l` = 3; `ls lib/*/` không còn `backdated-ledger`, `history-ops` |
| 3 | `ls -p lib \| grep -v /` rỗng; OPEN-ITEMS về "Không có việc treo"; `npm run build` xanh; `grep -rn "sheets_db" app lib components scripts docs --include=*.ts --include=*.tsx --include=*.md` rỗng |
| 4 | `ls components` = `dev-feedback providers ui`; `find app -name page.tsx \| wc -l` = 35 |
| 5 | 4 file `CLAUDE.md` vùng tồn tại; `wc -l CLAUDE.md` ≤ 199; `.claude/agents/reviewer.md` có; `sh .claude/hooks/session-start.sh` in 4 khối |
| 6 | `scripts/refactor-move.cjs` đã xoá; `verify-revenue` báo "0 lệch trên N" có N |

### 2.4 Review độc lập

Từ Task 23 trở đi có subagent `reviewer` (`.claude/agents/reviewer.md`): giao nó
đường dẫn kế hoạch + khoảng commit, nhận về danh sách lỗ hổng. Trước Task 23
dùng `/code-review` trên từng commit. **Không tự review việc mình vừa duyệt.**

### 2.5 Khi Sonnet xong

1. Chạy lại toàn bộ §2.2 + §2.3 đợt 6.
2. Đưa chủ quán danh sách 5 màn hình mở tận mắt (ghi ở Task 25 bước 6). Chờ chủ quán gật.
3. Hỏi **riêng một câu** về push. Không gộp với việc khác.
4. Sau push, deploy là việc khác, hỏi riêng; deploy xong phải có người mở trang sau đăng nhập.

---

## 3. Danh sách cải thiện còn lại — tìm thấy hôm nay, chưa nằm trong kế hoạch

Xếp theo giá trị. Mỗi dòng ghi bằng chứng đo được và ước lượng. Cột "ai quyết"
là ai phải gật trước khi làm.

### 3.1 Cao — đụng tiền hoặc đụng an toàn vận hành

| # | Việc | Bằng chứng | Ai quyết | Ước lượng |
|---|---|---|---|---|
| C1 | **Viết `scripts/verify-cogs.ts`** — hiện chỉ có `verify-revenue`, `verify-drive-backup`, `verify-restore-drill`. `CLAUDE.md` bảo "đụng giá vốn thì chạy verify-* tương ứng" nhưng script đó **không tồn tại**; giá vốn từng sai 7,4% (BR-COGS-006) mà không ai thấy | `ls scripts/verify-*` | kỹ thuật, tự làm; chủ quán chốt "0 lệch" nghĩa là gì (so với cái gì) | 1 buổi đặc tả + 1 buổi Sonnet |
| C2 | **Ghim vùng `sin1` vào `vercel.json`** thay vì chỉ để trong bảng điều khiển Vercel (README ghi "không cửa nào canh, re-link là mất"). *Chưa xác minh* khoá cấu hình đúng — tra `vercel:deployments-cicd` hoặc tài liệu Vercel trước, đừng đoán | `cat vercel.json` = `{}` | kỹ thuật; deploy phải chủ quán duyệt | 30 phút + 1 lần deploy |
| C3 | **Chạy 5 cửa trên GitHub Actions** khi push — hiện pre-commit chỉ chạy 3 cửa (không có `vitest`, không có `build`), và chỉ trên máy này. Kho không có `.github/` | `ls .github` → không có | chủ quán (tốn phút CI miễn phí của GitHub) | 1 buổi |
| C4 | Năm mục `BR-U-001`…`005` vẫn treo: POS ngoại tuyến là gì để nghiệm thu; ma trận quyền theo vai; tần suất diễn tập khôi phục; sửa tồn âm thật; mô hình đa chi nhánh | `docs/02-rules/business-rules/unresolved.md` | **chủ quán**, từng mục một | mỗi mục một lượt hỏi |

### 3.2 Vừa — chất lượng làm việc của agent

| # | Việc | Bằng chứng | Ai quyết | Ước lượng |
|---|---|---|---|---|
| V1 | **Sửa file toàn máy `C:\Users\Admin\CLAUDE.md`**: bỏ "luôn dùng Lodash", "CamelCase", câu về agent đã bỏ, và phần NestJS. Kế hoạch mới chỉ *che* bằng bảng thay thế; sửa gốc mới hết mâu thuẫn | 3 dòng bảng D7 | **chủ quán** (file ngoài kho, luật ghi "không được sửa") | 15 phút |
| V2 | **Cài `typescript-lsp`** trên máy chủ quán: `/plugin install typescript-lsp@claude-plugins-official`. Anthropic khuyên cho kho có kiểu; thay việc đọc file để tìm định nghĩa | chưa cài | chủ quán (máy của anh) | 5 phút |
| V3 | **Dọn `.claude/settings.local.json`**: nhiều quyền trỏ file đã xoá (`docs/FEATURE-CATALOG.md`, `scripts/lookup-item-names.ts`, `scripts/verify-all-479-clean.ts`…). Vô hại nhưng là điểm chết | `ls` ba file trên → không có | kỹ thuật; nhưng file `.claude/` phải chủ quán dán | 20 phút |
| V4 | **Soát 27 mục bộ nhớ tự động** (`~/.claude/projects/C--Users-Admin-Desktop-fnbapp/memory/`): mục nào nhắc agent đã bỏ, kế hoạch đã xoá, hoặc quyết định đã bị thay → sửa hoặc xoá. Chỉ mục nạp mọi phiên | 27 file | Opus tự làm, báo lại | 30 phút |
| V5 | `.claude/skills/ui-ux-pro-max/SKILL.md` mô tả ~1.000 ký tự; Anthropic cắt mô tả khi danh sách skill dài. Rút còn ~300 ký tự, dẫn đầu bằng từ khoá "màn hình quản trị, báo cáo, POS" | đo sáng 2026-09-07 | kỹ thuật | 15 phút |
| V6 | Sau khi Sonnet xong Task 3, **§6 của `2026-09-07-danh-gia-tung-file-tai-lieu.md` thành cũ** (ba mâu thuẫn đã giải). Thêm một dòng đầu §6: "đã giải 2026-09-07, xem `data-integrity.md`" | Task 3 kế hoạch | kỹ thuật | 5 phút |
| V7 | Cửa `check-rules-current` cảnh báo 5 dòng "số có đơn vị mà không có ngày" (`data-integrity.md:73`, `inventory.md:87`, `sales.md:41`, `assets.md:32,34`). Không chặn commit, nhưng là nhiễu mỗi lần chạy | chạy cửa | kỹ thuật | 15 phút |

### 3.3 Thấp — dọn dẹp, chờ dịp

| # | Việc | Bằng chứng | Ai quyết |
|---|---|---|---|
| T1 | **Tách `app/pos/components/POSScreen.tsx`** (1.143 dòng, sau Task 21). Có 4 file test bao quanh (checkoutToast, draftsModal, itemModal, offline) nên tách được an toàn, nhưng là đổi cấu trúc code có rủi ro hành vi — làm đợt riêng, có kế hoạch riêng | `wc -l` | kỹ thuật, kế hoạch riêng |
| T2 | `recovery-snapshots/` 8 bản chụp, **221 MB**, từ 07/2026, ngoài git nhưng nằm trong thư mục dự án; agent có thể vô tình mở. Chuyển ra ngoài thư mục kho hoặc xoá bản cũ | `du -sh` | **chủ quán** (bản sao lưu) |
| T3 | `skills-lock.json` ở gốc (gitignore) còn trỏ `.agents/` đã xoá — xoá file | `cat skills-lock.json` | kỹ thuật |
| T4 | Hai mục `TODO` trong `app/admin/nav-allowlist.ts`: `/admin/pos-sync` là màn hình thật chưa gắn menu; `/admin/products/toppings` chỉ redirect. Mỗi mục một câu hỏi cho chủ quán: gắn menu hay xoá | file allowlist | **chủ quán** |
| T5 | Hook `Stop` chạy cửa trước khi kết thúc lượt — Anthropic có gợi ý, nhưng `build` chậm; chỉ cân nhắc nếu Sonnet hay báo "xong" mà cửa đỏ | — | kỹ thuật, sau khi có số đo |

---

## 4. Sau đợt cấu trúc — bước kế trong lộ trình

Lộ trình chủ quán chốt (2026-07): kiểm toán → **sắp xếp kho (đợt này)** → hoàn
thiện tính năng → giao diện → đa chi nhánh → bảo mật → nhượng quyền.

Bước "hoàn thiện tính năng" đã có đề bài: **báo cáo tài chính và dòng tiền** —
xem bộ nhớ tự động `project_financial-reports-scope.md` và
`reference_vn-accounting-standards-2026.md` (ngưỡng thuế, chuẩn kế toán, **phải
tra lại trước khi dùng**, không đọc lại số trong file). App hiện chưa có chỗ
ghi chi phí, thu khác, vốn; khấu hao đã có. Đây là "tạo thứ chưa từng có" → đủ
bốn bước, đặc tả và thiết kế vào `docs/superpowers/specs/`, phỏng vấn chủ quán
bằng ví dụ cụ thể trước khi viết.

C1 (verify giá vốn) nên đi **trước** báo cáo tài chính: báo cáo lãi lỗ đọc giá
vốn, mà giá vốn chưa có phép kiểm chạy lại được.

---

## 5. Luật cho phiên Opus mới — những gì hôm nay đã vấp

- **Không tin bản tự khai.** Sáng nay một bản đặc tả tự khai "đã soát đủ"; soát lại thấy 4 luật rơi, 3 tài liệu sai hiện trạng, `.gitignore` bỏ sót hook. Cửa kiểm chỉ kiểm đường dẫn, không kiểm lời khẳng định.
- **Tài liệu không phải hiện trạng.** Mở bảng mà đo (`select … limit 1`), đừng đọc `migration list`, đừng đọc spec.
- **Mỗi lượt một vấn đề, tối đa ba câu, có khuyến nghị.** Chủ quán chọn bằng cách gõ số.
- **Bị chặn thì dừng.** Không `sed` vào `.claude/`.
- **Video Facebook không mở được** từ agent (chặn đăng nhập). Chủ quán gửi link video thì xin bản tóm tắt hoặc trả lời theo tài liệu chính thức, nói rõ là không xem được.
- Chủ quán đã chốt 2026-09-07: **không xây bộ nhớ CSV/SQLite/RAG** cho Claude; dùng git + file máy sinh + hook `SessionStart`. Đừng đề xuất lại.
