# Gate 2 Architecture and Access Map

Date: 2026-07-18  
Scope: repository evidence only; no production writes, deployment changes, or application remediation  
Tool baseline: `3570da0` (`scripts/audit-admin-action-auth.ts --json`)

## Tóm tắt cho chủ doanh nghiệp

Đợt kiểm tra đã lập bản đồ đầy đủ cho 81 thao tác phía máy chủ và 5 cổng truy cập API hiện có. Các cổng API đang dùng không còn lỗ hổng mới, nhưng có 25 thao tác chưa tự kiểm tra quyền khi bị gọi trực tiếp: 4 thao tác có thể thay đổi dữ liệu và 21 thao tác đọc dữ liệu. Ba thao tác bán hàng/POS còn có thể gán người thực hiện là “Hệ thống” khi không có đăng nhập.

Số vấn đề vượt giới hạn sửa nhỏ của Gate 2, nên đợt này chỉ ghi nhận đầy đủ và dừng để Claude chia thành nhiệm vụ bảo mật riêng. Không có dữ liệu thật nào bị thay đổi.

## Scope and evidence level

This report covers `docs/ACCESS-MODEL.md` verification items 1, 2, 3, 6, and 8:

- all current Server Action source files and exported actions;
- direct unauthenticated and wrong-role rejection evidence from local guards;
- all `app/api/**/route.ts` handlers;
- repository-visible authentication for the four Supabase Edge Functions;
- SYSTEM/CLI reachability in current action code.

The action and route matrix is static AST evidence. `GUARDED` means the current source obtains a recognized guard result and exits on failure. It does not claim an end-to-end production penetration test. Gate 1 regression tests provide direct invocation evidence for the backdated-ledger mutations and the two guarded maintenance routes.

Items 4 (brand/outlet isolation), 5 (RPC and privileged client boundary), 9 (RLS), and 10 (session expiry, disabled users, and role changes) remain open for Gate 3 or later. Item 7 (broad sensitive-field serialization/logging) is also not reopened here; Gate 1 closed the identified user credential exposure only.

## Method

The corrected read-only audit:

1. walks all TypeScript files under `app/`;
2. includes every `actions.ts` plus any other file with a top-level `"use server"` directive;
3. inventories exported function declarations, direct async arrows, cached/wrapped async arrows, and API export aliases;
4. classifies mutations from reviewed write calls rather than exported-function name prefixes;
5. counts `requireAdmin`, `resolveActor`, or `getServerSession` only when the result gates execution through an early return or throw;
6. distinguishes ADMIN enforcement from authentication-only enforcement;
7. treats NextAuth handlers and the retired HTTP 410 route as explicit public policies rather than silently assuming public access.

Command:

```powershell
node_modules\.bin\vite-node.cmd scripts\audit-admin-action-auth.ts --json
```

The command is read-only and intentionally exits non-zero while access findings remain.

## Coverage and result

| Surface | Files | Exported handlers | Result |
|---|---:|---:|---|
| Conventional `actions.ts` | 20 | included below | Complete inventory |
| Additional explicit-use-server file | 1 (`app/actions/auth.ts`) | included below | Complete inventory |
| All Server Actions | 21 | 81 | 60 mutations + 21 reads |
| API routes | 4 | 5 methods | 0 undocumented unguarded routes |
| Supabase Edge Functions | 4 | 4 function packages | 1 dedicated-token verified; 3 require deployment/auth follow-up |

| Action result | Count |
|---|---:|
| Mutations with matching local access gate | 56 |
| Mutation access findings | 4 |
| Reads with no local direct-invocation gate | 21 |
| **Total action findings** | **25** |

## Finding summary and stop-gate decision

### Mutation findings

| Finding | Evidence | Risk |
|---|---|---|
| `submitStockAdjustment` wrong-role gap | `resolveActor()` rejects anonymous callers but accepts STAFF; the action is under ADMIN scope and can insert adjustment/ledger rows | A cashier-level account can invoke an inventory write directly; future Inventory-role policy is unresolved |
| `submitOrderV2` unauthenticated fallback | No rejecting guard; missing session becomes actor `system`/`Hệ thống` before atomic order, line, event, and ledger writes | An external direct caller may create financially material records attributed to SYSTEM |
| `savePOSDraft` unauthenticated fallback | No rejecting guard; missing session becomes SYSTEM before insert/update | An external direct caller may create or alter drafts |
| `deletePOSDraft` no guard | Removes a draft without a session check | An external direct caller may delete drafts |

`getPOSDrafts` is the matching unguarded read exposure and is included in the 21 read findings.

### Stop-gate verdict

The corrected map found 25 action-level access gaps, more than the handoff's maximum of five for an unreviewed remediation wave. Remediation therefore stops here. There is also a genuine policy ambiguity around `submitStockAdjustment`: the current technical model has no Inventory role, so changing it to ADMIN-only would close today's cashier path but pre-decide a later business-role design.

Recommended reviewed follow-ups:

1. Highest priority: locally authenticate all four POS actions and remove unauthenticated SYSTEM fallback; keep SYSTEM only for explicit CLI execution.
2. Add ADMIN guards to the 20 admin read actions as one reviewed mechanical wave, with representative direct-invocation tests and audit verification.
3. Decide the temporary rule for `submitStockAdjustment` (ADMIN-only now, or a separately designed Inventory role later) before changing it.
4. Verify deployed Edge Function JWT settings, then retire or locally authenticate the legacy/unused functions.

## Server Action matrix

`Anonymous rejected` and `Wrong role rejected` report what the local function body enforces. `N/A` means the intended policy allows any authenticated role, not that the call is public.

| File | Export | Kind | Intended access | Local guard | Anonymous rejected | Wrong role rejected | Status |
|---|---|---|---|---|---|---|---|
| `app/actions/auth.ts` | `changePasswordAction` | MUTATION | AUTHENTICATED | SESSION/enforced | YES | N/A | `GUARDED` |
| `app/admin/audit/backdated-ledger/actions.ts` | `approveAndRecomputeAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/audit/backdated-ledger/actions.ts` | `rejectEventAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/backup/actions.ts` | `triggerBackup` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/brands/actions.ts` | `getBrands` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/brands/actions.ts` | `addBrand` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/brands/actions.ts` | `editBrand` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/brands/actions.ts` | `deleteBrand` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `addItemCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `updateItemCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `deleteItemCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `addBaseIngredient` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `updateBaseIngredient` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `deleteBaseIngredient` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `addPurchasedItem` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `updatePurchasedItem` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `deletePurchasedItem` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `addConversion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `updateConversion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `deleteConversion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `addUnit` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `updateUnit` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `deleteUnit` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `getRealtimeStock` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/inventory/actions.ts` | `submitStockAdjustment` | MUTATION | ADMIN | ACTOR/enforced | YES | NO | `WRONG_ROLE_GAP` |
| `app/admin/inventory/actions.ts` | `approveStockAdjustment` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/actions.ts` | `rejectStockAdjustment` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/base-ingredients/actions.ts` | `getBaseIngredientsData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/inventory/base-ingredients/actions.ts` | `addBaseIngredient` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/base-ingredients/actions.ts` | `updateBaseIngredient` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/base-ingredients/actions.ts` | `deleteBaseIngredientAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/conversions/actions.ts` | `getConversionsData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/inventory/conversions/actions.ts` | `addConversion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/conversions/actions.ts` | `updateConversion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/conversions/actions.ts` | `deleteConversionAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/items/actions.ts` | `getItemsData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/inventory/items/actions.ts` | `addPurchasedItem` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/items/actions.ts` | `updatePurchasedItem` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/items/actions.ts` | `deletePurchasedItemAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/purchase-orders/actions.ts` | `getPurchaseOrdersData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/inventory/purchase-orders/actions.ts` | `savePurchaseOrder` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/inventory/purchase-orders/actions.ts` | `addPurchaseSource` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/orders/actions.ts` | `getOrdersV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/orders/actions.ts` | `getOrderDetailV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/orders/actions.ts` | `voidOrderV2` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/orders/actions.ts` | `editOrderV2` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/production/actions.ts` | `getProductionData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/production/actions.ts` | `saveProductionOrder` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/actions.ts` | `saveProduct` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/actions.ts` | `deleteProduct` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/categories/actions.ts` | `getCategoriesWithCounts` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/products/categories/actions.ts` | `saveCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/categories/actions.ts` | `updateCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/categories/actions.ts` | `deleteCategory` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/modifiers/actions.ts` | `getModifiersData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/products/modifiers/actions.ts` | `saveModifierAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/modifiers/actions.ts` | `deleteModifierAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/products/toppings/actions.ts` | `toggleToppingStandalone` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/promotions/actions.ts` | `getPromotionsData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/promotions/actions.ts` | `savePromotion` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/promotions/actions.ts` | `deletePromotionAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/reports/actions.ts` | `getPnLDataV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/reports/actions.ts` | `getSalesDataV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/reports/actions.ts` | `getHourlyHeatmapV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/reports/actions.ts` | `getPromotionPerformanceV2` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/semi-products/actions.ts` | `getSemiProductsData` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/semi-products/actions.ts` | `saveSemiProduct` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/semi-products/actions.ts` | `deleteSemiProductAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/suppliers/actions.ts` | `getSuppliers` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/suppliers/actions.ts` | `addSupplier` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/suppliers/actions.ts` | `editSupplier` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/suppliers/actions.ts` | `deleteSupplierAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/users/actions.ts` | `getUsers` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/users/actions.ts` | `getUserById` | READ | ADMIN | NONE/not enforced | NO | NO | `UNGUARDED_READ` |
| `app/admin/users/actions.ts` | `addUser` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/users/actions.ts` | `deleteUserAction` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/admin/users/actions.ts` | `updateUser` | MUTATION | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/pos/actions.ts` | `submitOrderV2` | MUTATION | AUTHENTICATED | NONE/not enforced | NO | N/A | `UNGUARDED_MUTATION` |
| `app/pos/actions.ts` | `getPOSDrafts` | READ | AUTHENTICATED | NONE/not enforced | NO | N/A | `UNGUARDED_READ` |
| `app/pos/actions.ts` | `savePOSDraft` | MUTATION | AUTHENTICATED | NONE/not enforced | NO | N/A | `UNGUARDED_MUTATION` |
| `app/pos/actions.ts` | `deletePOSDraft` | MUTATION | AUTHENTICATED | NONE/not enforced | NO | N/A | `UNGUARDED_MUTATION` |

## API route matrix

| File | Method | Intended access | Local guard | Anonymous rejected | Wrong role rejected | Status |
|---|---|---|---|---|---|---|
| `app/api/auth/[...nextauth]/route.ts` | `GET` | PUBLIC_AUTH | NONE/not enforced | N/A | N/A | `INTENTIONAL_PUBLIC` |
| `app/api/auth/[...nextauth]/route.ts` | `POST` | PUBLIC_AUTH | NONE/not enforced | N/A | N/A | `INTENTIONAL_PUBLIC` |
| `app/api/inventory/sync/execute/route.ts` | `POST` | PUBLIC_RETIRED | NONE/not enforced | N/A | N/A | `RETIRED` |
| `app/api/inventory/sync/scan/route.ts` | `GET` | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |
| `app/api/revalidate/route.ts` | `GET` | ADMIN | ADMIN/enforced | YES | YES | `GUARDED` |

## Supabase Edge Function authentication surface

Deployment flags are not fully represented in repository source, so unknown platform JWT settings remain unknown rather than being inferred.

| Function | Local request authentication | Privileged effect | Evidence verdict |
|---|---|---|---|
| `backup-to-drive` | Dedicated `X-Backup-Token`, minimum 32 characters, constant-time comparison; POST only | Reads the approved full backup schema with a service-role client | `VERIFIED_TOKEN`: handler/contract tests and production Apps Script pull verification; intentionally deployed without platform JWT because the dedicated token is the boundary |
| `backup-to-sheets` | No local caller authentication in `index.ts` | Reads with service role, writes Google Sheets and `sync_state` | `UNVERIFIED_PLATFORM_BOUNDARY`: legacy function; current deployment JWT setting is not repository-backed. Manual admin action is guarded but calls this obsolete target (FIX-2 remains separate) |
| `notify-order` | No local caller authentication in `index.ts` | Sends arbitrary caller-supplied order content to the configured Telegram chat | `GAP_IF_DEPLOYED_OPEN`: no application caller and deployment setting unverified; platform JWT behavior must be confirmed before calling it protected |
| `user-admin` | Normal routes validate a Supabase Auth JWT and require profile role `owner`; `/migrate` locally decodes a claimed `service_role` without signature verification | Full auth-user and profile create/update/delete; migration reads credential rows internally | `PARTIAL`: normal local owner check exists, but deployment JWT enforcement is unverified and `/migrate` is safe only if the platform verifies the token signature before invocation |

The `user-admin /migrate` condition is a stop-and-review item: do not deploy it with `--no-verify-jwt` unless its local service-role verification is replaced with signature-backed verification or the route is removed.

## ACCESS-MODEL verification checklist disposition

| Item | Gate 2 disposition | Evidence |
|---:|---|---|
| 1. Every user-reachable route and Server Action | `EVIDENCE_BACKED` for current repo | 21 action files / 81 exports; 4 API files / 5 handlers; four Edge Function packages reviewed |
| 2. Direct invocation without session | `GAP_IDENTIFIED` | 3 unguarded POS mutations + 21 unguarded reads; guarded rows show enforced early exit statically |
| 3. Wrong-role invocation | `PARTIAL/GAP` | 56 mutations have matching local gates; `submitStockAdjustment` permits any authenticated technical role; read actions have no local role gate |
| 4. Brand/shop/outlet scope | Open for later work | One-shop scope; no multi-outlet isolation claim |
| 5. RPC and privileged server-client use | Open for Gate 3 | Not certified by this source-level map |
| 6. API route and Edge Function authentication | `API_EVIDENCE_BACKED`, `EDGE_PARTIAL` | 0 undocumented API gaps; Edge Function table above records one verified token boundary and three unresolved deployment/local-auth boundaries |
| 7. Sensitive serialization/logging | Outside this Gate 2 pass | Gate 1 closed the named credential leak; broad review remains separate |
| 8. SYSTEM/CLI-only paths | `GAP_IDENTIFIED` | `submitOrderV2` and `savePOSDraft` assign SYSTEM when no session exists; external direct calls are not rejected |
| 9. RLS policies and bypass assumptions | Open for Gate 3 | Explicitly out of scope |
| 10. Session expiry/disabled users/role changes | Open for Gate 3+ | Explicitly out of scope |

## Conclusion

Gate 2 successfully replaced an under-reporting audit with a complete current-source map. It did not close the newly visible access gaps. The next security change must be separately reviewed because the findings span financially material POS writes, a currently unresolved Inventory-role decision, a broad set of admin reads, and deployment-dependent Edge Function boundaries.

No database, production service, secret, migration, or remote repository was changed.
