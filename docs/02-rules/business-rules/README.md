# Business Rules

Status: canonical rule index

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này là cửa vào để biết quy tắc vận hành nào đã được duyệt, quy tắc nào mới chỉ quan sát thấy trong hệ thống và điểm nào còn chờ quyết định. Các công thức kỹ thuật dài vẫn nằm trong tài liệu chuyên sâu; ở đây chỉ ghi nguyên tắc và dẫn đến nguồn chi tiết.

Không được dùng hành vi hiện có trong code để tự tạo một quy tắc kinh doanh mới. Quy tắc mới hoặc thay đổi chính sách cần owner phê duyệt và ghi ngày áp dụng.
## Rule status

| Status | Meaning |
|---|---|
| `APPROVED` | Owner-approved operating policy or reviewed invariant currently in force |
| `OBSERVED` | Current implementation behavior that has not been elevated to owner-approved policy |
| `UNRESOLVED` | A business or operational decision is still required |
| `RETIRED` | Historical rule no longer in force; successor and effective date required |

When a rule changes, preserve the old decision in Git/audit evidence and record the new effective date. Do not silently rewrite production history to make old transactions follow a new rule.
## Rule index

| Domain file | Contents | Code family |
|---|---|---|
| [`docs/02-rules/business-rules/sales.md`](sales.md) | Sales and order rules | `BR-SALE-*` |
| [`docs/02-rules/business-rules/cogs.md`](cogs.md) | COGS and reporting rules | `BR-COGS-*` |
| [`docs/02-rules/business-rules/inventory.md`](inventory.md) | Inventory, purchasing, and production rules | `BR-INV-*` |
| [`docs/02-rules/business-rules/catalog.md`](catalog.md) | Catalogue rules | `BR-CATALOG-*` |
| [`docs/02-rules/business-rules/data-integrity.md`](data-integrity.md) | Backdated, audit/recovery, and backup rules | `BR-BACKDATE-*`, `BR-DATA-*`, `BR-BACKUP-*` |
| [`docs/02-rules/business-rules/access.md`](access.md) | Access and security rules | `BR-ACCESS-*` |
| [`docs/02-rules/business-rules/unresolved.md`](unresolved.md) | Unresolved items awaiting a decision | `BR-U-*` |

## Authority hierarchy

This index summarizes rules for discovery. Detailed sources remain authoritative within their narrow scope:

- terminology: [`docs/02-rules/GLOSSARY.md`](../GLOSSARY.md);
- where a change reaches across the system: [`docs/01-system/SYSTEM-MAP.md`](../../01-system/SYSTEM-MAP.md);
- how a flow works end to end: the workflow docs in [`docs/03-workflows/`](../../03-workflows/).

If a summary here conflicts with a reviewed detailed source, stop and resolve the contradiction rather than choosing whichever result is convenient.

## Change procedure

1. Identify the rule ID and current source/evidence.
2. State the business impact and effective date.
3. Obtain owner approval for policy changes.
4. Update the relevant detailed source if technical detail changes.
5. Update implementation/tests in a separately reviewed task.
6. Preserve historical evidence in Git/audit records.

Update this index when a rule is approved, retired, contradicted by verified implementation, or moved to a different authority.
