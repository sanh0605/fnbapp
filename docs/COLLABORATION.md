# Collaboration Protocol — Claude × Codex

File này là **single source of truth** cho cách 2 agent (Claude Code + Codex) giao tiếp trong repo `fnbapp`. Cả 2 phải đọc file này đầu mỗi phiên.

Cập nhật mỗi khi có thay đổi về quy tắc hoặc cấu trúc file.

---

## 1. File dùng chung

| File | Role | Khi nào update |
|---|---|---|
| `docs/COLLABORATION.md` | **THIS FILE** — protocol, quy tắc, file map | Khi đổi convention/structure |
| `DEVELOPMENT-TRACKING.md` | **Chronicle log** — mọi thay đổi (newest first) | Cuối mỗi phiên làm việc |
| `docs/audits/codex-handoff-2026-06-25.md` | **Active task tracking** — items với status `[ ]`/`[x]`/`[~]`/`[!]` | Khi item đổi trạng thái |
| `docs/audits/2026-06-25-full-system-audit-roadmap.md` | **Strategic roadmap** — phase/task long-term | Khi phase đổi status (in progress → done) |
| `docs/audits/script-cleanup-plan.md` | **Script inventory** — 135 scripts categorized | Khi script add/remove/change category |
| `docs/domain-dictionary.md` | **Terminology** — code/sheet/UI terms | Khi thêm/chưa term mới |

---

## 2. Status markers (cho task lists)

```
[ ]   pending — chưa làm
[x]   done — đã làm xong + verify
[~]   partial — làm 1 phần, ai đó complete
[!]   skip — có lý do, đọc note ngay sau item
[-]   obsolete — không còn apply (direction change, etc.)
```

**Quy tắc**:
- Khi đánh dấu `[x]`: phải có note `**Done by Claude/Codex** — <tóm tắt>` ngay sau item
- Khi `[!]` hoặc `[-]`: phải có note lý do
- Không xoá item — giữ để audit trail

---

## 3. Commit message conventions

| Prefix | Ý nghĩa | Ai |
|---|---|---|
| `Claude:` | Claude Code làm | Claude |
| `Codex:` | Codex làm | Codex |
| `fix:` | Bug fix | Cả 2 |
| `feat:` | Feature mới | Cả 2 |
| `chore:` | Refactor, cleanup, scripts | Cả 2 |
| `docs:` | Documentation | Cả 2 |

Format đầy đủ: `<prefix> <scope>: <description>` (ví dụ `Claude fix: mac ledger type safe`)

Body commit có section `Co-Authored-By:` nếu合作. Không push unless explicitly asked.

---

## 4. Quy trình làm việc mỗi phiên

### Bắt đầu phiên

1. Đọc `docs/COLLABORATION.md` (file này).
2. Đọc `DEVELOPMENT-TRACKING.md` 3 entries mới nhất.
3. Đọc `docs/audits/codex-handoff-2026-06-25.md` (active task tracking).
4. Check `docs/audits/2026-06-25-full-system-audit-roadmap.md` phase hiện tại.

### Trong phiên

- Mỗi thay đổi code: thêm entry vào `DEVELOPMENT-TRACKING.md` cuối phiên (không phải mỗi commit).
- Mỗi item task tracking: update status marker + note ngay sau item.
- Phát hiện issue mới: thêm item vào handoff section tương ứng + note `Discovered by Claude/Codex`.

### Cuối phiên

1. Update `DEVELOPMENT-TRACKING.md` với entry mới (newest first).
2. Update `docs/audits/codex-handoff-2026-06-25.md` status markers.
3. Chạy verify commands (xem section 5).
4. Nếu có commit, note commit sha trong tracking entry.

---

## 5. Verify commands (chạy trước khi kết thúc phiên)

```bash
rtk node_modules/.bin/vitest run                                       # Test suite
rtk node_modules/.bin/vite-node.cmd scripts/audit-mac-cogs-drift.ts    # MAC primary
rtk node_modules/.bin/vite-node.cmd scripts/audit-cogs-drift.ts        # FIFO informational only
rtk node_modules/.bin/vite-node.cmd scripts/audit-current-stock.ts     # Stock ledger
rtk node_modules/.bin/vite-node.cmd scripts/audit-order-ledger.ts      # Order ledger
rtk node_modules/.bin/vite-node.cmd scripts/audit-purchase-ledger.ts   # PO ledger
rtk node_modules/.bin/tsc --noEmit                                     # TypeScript
```

Baseline hiện tại:
- Tests: **187/187 pass**
- MAC drift: **0 mismatch**
- Current stock: **0 negative**
- Order ledger: **0 mismatch**
- PO ledger: **0 mismatch**
- TypeScript: **0 errors**

---

## 6. Quy tắc giao tiếp

### Khi phát hiện issue của agent kia

1. **Không tự fix ngay** nếu:
   - Issue nằm ngoài scope task hiện tại
   - Fix có thể break logic đang chạy
2. **Add note** vào `DEVELOPMENT-TRACKING.md` entry mới với format:
   ```
   ### Issues found in <agent> code — <status>
   | Issue | File:line | Fix/Defer |
   ```
3. **Mark `Codex review notes` numbered** ở cuối entry để agent kia dễ respond.

### Khi agent kia feedback

1. Đọc `DEVELOPMENT-TRACKING.md` entries mới nhất từ agent kia.
2. Respond bằng entry mới với header `## <Date> (<agent>) — Response to <other agent>'s notes`.
3. Quote specific note number + trả lời.

### Khi direction change (lớn)

1. Agent propose direction change → add entry `## <Date> (<agent>) — <change> decision` vào tracking.
2. Update `docs/audits/codex-handoff-2026-06-25.md` với section "Direction change log" đầu file.
3. Re-evaluate items trong handoff — mark `[-] obsolete` cho items không còn apply + note lý do.

---

## 7. Current direction (snapshot 2026-06-26)

- **COGS valuation**: MAC (weighted average) — `lib/mac-cogs.ts`, pin vào `Order_Lines_V2.cost_at_sale` lúc sale/edit
- **Inventory quantity**: ledger-based — `Stock_Ledger.quantity_change` vẫn là source of truth
- **FIFO**: audit/debug only — `lib/cogs-drift-audit.ts` giờ informational, không phải primary contract
- **Phase status**:
  - Phase 0-5: done
  - Phase 5A (MAC migration): done
  - Phase 6.1 (script cleanup plan): done
  - Phase 6.2-6.5: defer
  - Phase 7 (mobile UI): defer
  - Phase 8 (offline/sync): defer

---

## 8. Quick links

- [Active handoff](audits/codex-handoff-2026-06-25.md) — task list với status
- [Strategic roadmap](audits/2026-06-25-full-system-audit-roadmap.md) — phases
- [Script cleanup plan](audits/script-cleanup-plan.md) — 135 scripts categorized
- [Domain dictionary](domain-dictionary.md) — terminology
- [Development tracking](../DEVELOPMENT-TRACKING.md) — chronicle log

---

## 9. Change log cho file này

- **2026-06-26 (Claude)**: Tạo file. Định nghĩa protocol sau khi phát hiện handoff 2026-06-25 không reflect MAC direction change. Cần single source of truth.
