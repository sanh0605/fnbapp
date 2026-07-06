# Antigravity Prompt — Vietnamese diacritics sweep (BrandForm)

Date: 2026-07-06
Owner: Antigravity (UI Lead)
Trigger: Post-migration polish. Phase A1/A2 fixed DeleteConfirmModal + LoadingButton shared defaults. Remaining file with display labels missing diacritics: `BrandForm.tsx`.

## Bug summary

`app/admin/brands/components/BrandForm.tsx` has 4 user-facing strings in ASCII Vietnamese (no diacritics). Compare with `SupplierForm.tsx` (line 60, 68, 74, 76) which uses proper diacritics — `SupplierForm` is the correct reference pattern.

Other forms (UserForm, PurchasedItemForm, ConversionForm, etc.) were spot-checked and already use proper diacritics.

## Files

- `app/admin/brands/components/BrandForm.tsx` (only file needing changes)

## Issues (file:line)

```text
app/admin/brands/components/BrandForm.tsx:71 - title="Sua Thuong Hieu" → "Sửa Thương Hiệu"
app/admin/brands/components/BrandForm.tsx:71 - title="Them Thuong Hieu Moi" → "Thêm Thương Hiệu Mới"
app/admin/brands/components/BrandForm.tsx:88 - loadingText="Dang luu..." → "Đang lưu…"
app/admin/brands/components/BrandForm.tsx:90 - "Cap nhat" → "Cập nhật"
app/admin/brands/components/BrandForm.tsx:90 - "Luu Thuong Hieu" → "Lưu Thương Hiệu"
app/admin/brands/components/BrandForm.tsx:165 - "Xoa" → "Xoá"
app/admin/brands/components/BrandForm.tsx:165 - "..." → "…" (ellipsis character)
```

## Architecture note (important — DO NOT change)

Some files use ASCII strings as **data values** (not display labels). These are correct architecture and must NOT be changed:

```ts
// CORRECT — data values stay ASCII for DB consistency:
const [paymentMethod, setPaymentMethod] = useState(order.method || "Tien mat");
handleConfirmCheckoutRef.current("Tien mat");
<option value="Tien mat">Tiền mặt</option>  // value=ASCII, label=diacritics
order.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"  // compare ASCII, display diacritics
```

Files with this correct pattern (do NOT modify):
- `components/POSScreen.tsx`
- `components/pos/CartPanel.tsx`
- `app/admin/orders/OrderTable.tsx`
- `app/admin/orders/OrderEditModal.tsx`

## Broader sweep (optional, if time permits)

Run a broader grep to catch any other Vietnamese display labels missing diacritics:

```bash
grep -rnE '"(Sua|Them|Luu|Xoa|Huy|Chon|Tim|Dang|Tien|Chuyen|Hoa|Tinh|Don|Cua|Nhap|Xuat) ' app/admin components
```

If new instances found beyond BrandForm.tsx, fix them too in the same commit. If unclear whether a string is data value or display label, ask in commit message body.

## Verification

1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → 308+ tests pass
3. Manual check:
   - Navigate to `/admin/brands`
   - Click "Thêm Thương Hiệu" — modal title shows "Thêm Thương Hiệu Mới" with diacritics
   - Submit empty form — button shows "Đang lưu…" with diacritics + ellipsis char
   - Edit existing brand — title shows "Sửa Thương Hiệu", button shows "Cập nhật"
   - Click delete — confirm dialog shows "Xoá" with diacritics
4. Cross-check: existing brand data should still work (data values unchanged)

## Commit

Suggested: `Antigravity fix: Vietnamese diacritics in BrandForm (parity with SupplierForm)`

## Out of scope

- Do NOT change data value strings (`"Tien mat"`, `"Chuyen khoan"`) — those are correct
- Do NOT refactor BrandForm architecture
- Do NOT touch SupplierForm (it's the reference)
- Surgical: 4 lines changed, 1 file
