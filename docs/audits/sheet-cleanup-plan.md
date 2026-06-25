# Google Sheets Cleanup Plan

Generated: 2026-06-25T03:50:37.942Z

## Summary

- KEEP: 24
- REVIEW: 28
- ARCHIVE_CANDIDATE: 12
- Code references found: 723

## Recommended Process

1. Keep all `KEEP` sheets unchanged.
2. Manually inspect `REVIEW` sheets for formulas, pivots, dashboards, and external integrations.
3. Rename `ARCHIVE_CANDIDATE` sheets to `ZZ_ARCHIVE_<old_name>` first; do not delete immediately.
4. Run order ledger, COGS, purchase ledger, and current stock audits after renaming.
5. Delete archived sheets only after a verified backup and one successful operating cycle.

## Sheets

| Status | Sheet | Size | Reason | References |
| --- | --- | ---: | --- | --- |
| KEEP | Base_Ingredients | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-negative-stock-periods.ts:18<br>scripts\audit-modifier-recipes.ts:42<br>scripts\audit-current-stock.ts:32<br>scripts\apply-negative-stock-adjustments.ts:28<br>scripts\add-non-inventory-column.ts:27<br>+30 more |
| KEEP | Item_Categories | 1000x26 | Referenced by code with exact sheet name. | app\admin\inventory\actions.ts:15<br>app\admin\inventory\actions.ts:16<br>app\admin\inventory\actions.ts:30<br>app\admin\inventory\actions.ts:41<br>app\admin\inventory\items\actions.ts:20<br>+1 more |
| KEEP | Modifiers | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-modifier-recipes.ts:40<br>scripts\test-submit-order-v2.ts:32<br>scripts\migrate-orders-to-v2.ts:79<br>app\pos\actions.ts:57<br>app\pos\page.tsx:31<br>+3 more |
| KEEP | Order_Events | 896x26 | Referenced by code with exact sheet name. | scripts\cleanup-test-orders-v2.ts:30<br>scripts\cleanup-test-orders-v2.ts:101<br>scripts\test-void-order-v2.ts:43<br>scripts\test-edit-order-v2.ts:77<br>scripts\reset-v2-sheets.ts:26<br>+9 more |
| KEEP | Order_Lines | 1156x26 | Referenced by code with exact sheet name. | scripts\add-line-manual-discount-column.ts:29<br>scripts\add-line-manual-discount-column.ts:43<br>scripts\audit-specific-order.ts:37<br>scripts\audit-revenue-anomalies.ts:129<br>scripts\backfill-orders-subtotal.ts:13<br>+48 more |
| KEEP | Order_Lines_V2 | 1253x26 | Referenced by code with exact sheet name. | scripts\audit-cogs-drift.ts:25<br>scripts\apply-order-modifier-qty-cleanup.ts:48<br>scripts\apply-order-modifier-qty-cleanup.ts:111<br>scripts\apply-order-ledger-net-corrections.ts:18<br>scripts\apply-cogs-recalc.ts:15<br>+53 more |
| KEEP | Orders_V2 | 892x26 | Referenced by code with exact sheet name. | scripts\audit-cogs-drift.ts:24<br>scripts\apply-order-modifier-qty-cleanup.ts:47<br>scripts\apply-order-ledger-net-corrections.ts:17<br>scripts\apply-cogs-recalc.ts:14<br>scripts\audit-order-modifier-qty.ts:26<br>+58 more |
| KEEP | POS_Drafts | 999x26 | Referenced by code with exact sheet name. | app\pos\actions.ts:221<br>app\pos\actions.ts:248<br>app\pos\actions.ts:251<br>app\pos\actions.ts:271<br>app\pos\actions.ts:280 |
| KEEP | Product_Categories | 1000x26 | Referenced by code with exact sheet name. | scripts\test-submit-order-v2.ts:31<br>scripts\migrate-orders-to-v2.ts:78<br>scripts\migrate-data.ts:46<br>scripts\migrate-data.ts:50<br>scripts\migrate-data.ts:51<br>+9 more |
| KEEP | Product_Price_History | 1000x26 | Referenced by code with exact sheet name. | scripts\init-history-tables.ts:57<br>app\admin\products\page.tsx:57 |
| KEEP | Product_Variants | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-revenue-anomalies.ts:130<br>scripts\calculate-yogurt-cogs.ts:7<br>scripts\find-promo-undercount-bugs.ts:18<br>scripts\find-revenue-anomalies-broad.ts:22<br>scripts\test-void-order-v2.ts:18<br>+18 more |
| KEEP | Production_Items | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-production-stock.ts:16<br>app\admin\production\actions.ts:21<br>app\admin\production\actions.ts:69<br>app\admin\production\actions.ts:70 |
| KEEP | Production_Orders | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-production-stock.ts:15<br>app\admin\production\actions.ts:20<br>app\admin\production\actions.ts:59<br>app\admin\production\actions.ts:62 |
| KEEP | Promotions | 997x26 | Referenced by code with exact sheet name. | scripts\audit-revenue-anomalies.ts:132<br>scripts\classify-promo-context.ts:85<br>scripts\find-promo-undercount-bugs.ts:19<br>scripts\find-promo-plus-order-discount.ts:21<br>scripts\find-revenue-anomalies-broad.ts:23<br>+16 more |
| KEEP | Purchase_Order_Lines | 973x26 | Referenced by code with exact sheet name. | scripts\apply-purchase-ledger-cleanup.ts:28<br>scripts\apply-purchase-ledger-cleanup.ts:99<br>scripts\apply-purchase-ledger-cleanup.ts:109<br>scripts\apply-purchase-ledger-cleanup.ts:121<br>scripts\audit-purchase-ledger.ts:31<br>+18 more |
| KEEP | Purchase_Orders | 999x26 | Referenced by code with exact sheet name. | scripts\apply-purchase-ledger-cleanup.ts:27<br>scripts\add-transaction-date.ts:23<br>scripts\add-transaction-date.ts:30<br>scripts\audit-purchase-ledger.ts:30<br>scripts\delete-po001.ts:27<br>+9 more |
| KEEP | Purchase_Sources | 1000x10 | Referenced by code with exact sheet name. | app\admin\inventory\purchase-orders\actions.ts:178<br>app\admin\inventory\purchase-orders\actions.ts:179<br>app\admin\inventory\purchase-orders\[id]\page.tsx:17<br>app\admin\inventory\purchase-orders\new\page.tsx:14 |
| KEEP | Recipes | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-modifier-recipes.ts:41<br>scripts\audit-cogs-drift.ts:27<br>scripts\apply-modifier-recipe-normalization.ts:29<br>scripts\apply-modifier-recipe-normalization.ts:44<br>scripts\apply-cogs-recalc.ts:17<br>+22 more |
| KEEP | Stock_Adjustments | 1000x26 | Referenced by code with exact sheet name. | app\admin\inventory\actions.ts:411<br>app\admin\inventory\actions.ts:416<br>app\admin\inventory\actions.ts:453<br>app\admin\inventory\actions.ts:460<br>app\admin\reports\stock\page.tsx:22 |
| KEEP | Stock_Ledger | 3996x26 | Referenced by code with exact sheet name. | scripts\audit-negative-stock-periods.ts:17<br>scripts\audit-current-stock.ts:31<br>scripts\audit-cogs-drift.ts:26<br>scripts\apply-purchase-ledger-cleanup.ts:31<br>scripts\apply-purchase-ledger-cleanup.ts:128<br>+71 more |
| KEEP | Suppliers | 1000x26 | Referenced by code with exact sheet name. | scripts\migrate-data.ts:109<br>scripts\migrate-data.ts:112<br>scripts\migrate-data.ts:113<br>app\admin\page.tsx:29<br>app\admin\inventory\purchase-orders\actions.ts:18<br>+2 more |
| KEEP | Units | 999x10 | Referenced by code with exact sheet name. | scripts\audit-negative-stock-periods.ts:20<br>scripts\audit-current-stock.ts:34<br>scripts\apply-negative-stock-adjustments.ts:30<br>scripts\add-unit-actions.js:23<br>scripts\add-unit-actions.js:24<br>+29 more |
| KEEP | UOM_Conversions | 997x26 | Referenced by code with exact sheet name. | scripts\apply-purchase-ledger-cleanup.ts:30<br>scripts\audit-purchase-ledger.ts:33<br>scripts\reprocess-all-po-ledger.ts:36<br>scripts\migrate-units-to-ids.ts:28<br>scripts\migrate-units-to-ids.ts:45<br>+23 more |
| KEEP | users | 998x26 | Referenced by code with exact sheet name. | app\actions\auth.ts:20<br>app\actions\auth.ts:57 |
| REVIEW | CCDC | 1000x28 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | CHUẨN BỊ TRƯỚC BÁN | 1001x27 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Finished_Product_Prices | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Finished_Product_Recipes | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Finished_Products | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Inventory_Batches | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Inventory_Transactions | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | order_counters | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | outlets | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | P&L | 1002x44 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Permissions | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | PO_Items | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | POS_Order_Items | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | POS_Orders | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Product_Brands | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | product_recipes | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | QUY TRÌNH TRIỂN KHAI | 1022x25 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | raw_materials | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | semi_product_recipes | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | settings | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Spoilage_Items | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Spoilage_Orders | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Stocktake_Records | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | supplies | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Thansg 3 | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | TONG | 1001x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | Trang tính2 | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| REVIEW | User_Brands | 1000x26 | No direct code reference found; inspect manually before archive/delete. |  |
| ARCHIVE_CANDIDATE | brands | 1000x26 | Only case/style variant is referenced by code; likely duplicate legacy tab. | scripts\test-void-order-v2.ts:21<br>scripts\test-submit-order-v2.ts:28<br>scripts\test-pnl-v2.ts:26<br>scripts\test-edit-order-v2.ts:24<br>scripts\migrate.js:40<br>+10 more |
| ARCHIVE_CANDIDATE | Order_Lines_BACKUP_PRE_WS5_2026-06-19 | 1156x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | Order_Lines-Backup-2026-06-17 | 1162x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | Order_Lines-Backup-PhaseE | 1160x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | orders | 1349x26 | Only case/style variant is referenced by code; likely duplicate legacy tab. | scripts\add-snapshot-column.ts:29<br>scripts\add-snapshot-column.ts:43<br>scripts\audit-specific-order.ts:16<br>scripts\audit-revenue-anomalies.ts:128<br>scripts\backfill-orders-subtotal.ts:12<br>+66 more |
| ARCHIVE_CANDIDATE | Orders_BACKUP_PRE_WS5_2026-06-19 | 1349x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | Orders-Backup-2026-06-17 | 1351x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | Orders-Backup-PhaseE | 1349x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | products | 1000x26 | Only case/style variant is referenced by code; likely duplicate legacy tab. | scripts\audit-revenue-anomalies.ts:131<br>scripts\check-total-cogs.ts:7<br>scripts\calculate-yogurt-cogs.ts:6<br>scripts\find-revenue-anomalies-broad.ts:21<br>scripts\test-void-order-v2.ts:17<br>+20 more |
| ARCHIVE_CANDIDATE | purchased_items | 1000x26 | Only case/style variant is referenced by code; likely duplicate legacy tab. | scripts\apply-purchase-ledger-cleanup.ts:29<br>scripts\audit-purchase-ledger.ts:32<br>scripts\audit-water-sugar-transition.ts:22<br>scripts\reprocess-all-po-ledger.ts:35<br>app\admin\inventory\actions.ts:130<br>+10 more |
| ARCHIVE_CANDIDATE | semi_products | 1000x26 | Only case/style variant is referenced by code; likely duplicate legacy tab. | scripts\audit-negative-stock-periods.ts:19<br>scripts\audit-modifier-recipes.ts:43<br>scripts\audit-current-stock.ts:33<br>scripts\audit-cogs-drift.ts:28<br>scripts\apply-negative-stock-adjustments.ts:29<br>+23 more |
| ARCHIVE_CANDIDATE | Stock_Ledger_BACKUP_PRE_WS5_2026-06-19 | 2925x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
