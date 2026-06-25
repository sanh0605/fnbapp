# Google Sheets Cleanup Plan

Generated: 2026-06-25T07:39:57.919Z

## Summary

- KEEP: 29
- REVIEW: 0
- ARCHIVE_CANDIDATE: 28
- Code references found: 711

## Recommended Process

1. Keep all `KEEP` sheets unchanged.
2. Manually inspect `REVIEW` sheets for formulas, pivots, dashboards, and external integrations.
3. Rename `ARCHIVE_CANDIDATE` sheets to `ZZ_ARCHIVE_<old_name>` first; do not delete immediately.
4. Run order ledger, COGS, purchase ledger, and current stock audits after renaming.
5. Delete archived sheets only after a verified backup and one successful operating cycle.

## Sheets

| Status | Sheet | Size | Reason | References |
| --- | --- | ---: | --- | --- |
| KEEP | Base_Ingredients | 1000x26 | Referenced by code with exact sheet name. | scripts\test-submit-order-v2.ts:35<br>scripts\migrate-units-to-ids.ts:16<br>scripts\migrate-units-to-ids.ts:22<br>scripts\migrate-data.ts:54<br>scripts\migrate-data.ts:76<br>+28 more |
| KEEP | brands | 1000x26 | Referenced by code through a case/style variant; Google Sheets ranges are serving this tab. | scripts\test-void-order-v2.ts:21<br>scripts\test-submit-order-v2.ts:28<br>scripts\test-pnl-v2.ts:26<br>scripts\test-edit-order-v2.ts:24<br>scripts\migrate.js:40<br>+10 more |
| KEEP | Item_Categories | 1000x26 | Referenced by code with exact sheet name. | app\admin\inventory\actions.ts:15<br>app\admin\inventory\actions.ts:16<br>app\admin\inventory\actions.ts:30<br>app\admin\inventory\actions.ts:41<br>app\admin\inventory\categories\page.tsx:8<br>+1 more |
| KEEP | Modifiers | 1000x26 | Referenced by code with exact sheet name. | scripts\test-submit-order-v2.ts:32<br>scripts\migrate-orders-to-v2.ts:79<br>scripts\audit-modifier-recipes.ts:40<br>app\pos\page.tsx:31<br>app\pos\actions.ts:57<br>+3 more |
| KEEP | Order_Events | 899x26 | Referenced by code with exact sheet name. | lib\sheets-db-v2.ts:55<br>lib\sheets-db-v2-edit.ts:83<br>scripts\test-void-order-v2.ts:43<br>scripts\test-edit-order-v2.ts:77<br>scripts\reset-v2-sheets.ts:26<br>+9 more |
| KEEP | Order_Lines | 1156x26 | Referenced by code with exact sheet name. | scripts\zero-out-prorated-line-discounts.ts:8<br>scripts\zero-out-prorated-line-discounts.ts:30<br>scripts\verify-latest-test-order.ts:45<br>scripts\verify-june-revenue.ts:5<br>scripts\verify-e1-fix.ts:28<br>+48 more |
| KEEP | Order_Lines_V2 | 1258x26 | Referenced by code with exact sheet name. | lib\sheets-db-v2.ts:50<br>lib\sheets-db-v2-edit.ts:78<br>lib\sheet-usage-audit.test.ts:10<br>scripts\verify-v2-invariants.ts:10<br>scripts\test-edit-order-v2.ts:76<br>+52 more |
| KEEP | orders | 1349x26 | Referenced by code through a case/style variant; Google Sheets ranges are serving this tab. | scripts\zero-out-prorated-line-discounts.ts:7<br>scripts\verify-orders-schema.ts:13<br>scripts\verify-orders-schema.ts:26<br>scripts\verify-latest-test-order.ts:16<br>scripts\verify-june-revenue.ts:4<br>+66 more |
| KEEP | Orders_V2 | 895x26 | Referenced by code with exact sheet name. | lib\sheets-db-v2.ts:45<br>lib\sheets-db-v2-edit.ts:50<br>lib\sheets-db-v2-edit.ts:66<br>lib\sheets-db-v2-edit.ts:73<br>lib\sheet-usage-audit.test.ts:7<br>+57 more |
| KEEP | POS_Drafts | 999x26 | Referenced by code with exact sheet name. | app\pos\actions.ts:221<br>app\pos\actions.ts:248<br>app\pos\actions.ts:251<br>app\pos\actions.ts:271<br>app\pos\actions.ts:280 |
| KEEP | Product_Categories | 1000x26 | Referenced by code with exact sheet name. | scripts\test-submit-order-v2.ts:31<br>scripts\migrate-orders-to-v2.ts:78<br>scripts\migrate-data.ts:46<br>scripts\migrate-data.ts:50<br>scripts\migrate-data.ts:51<br>+9 more |
| KEEP | Product_Price_History | 1000x26 | Referenced by code with exact sheet name. | scripts\init-history-tables.ts:57<br>app\admin\products\page.tsx:57 |
| KEEP | Product_Variants | 1000x26 | Referenced by code with exact sheet name. | scripts\test-void-order-v2.ts:18<br>scripts\test-submit-order-v2.ts:30<br>scripts\test-pnl-v2.ts:23<br>scripts\test-edit-order-v2.ts:20<br>scripts\migrate-orders-to-v2.ts:77<br>+17 more |
| KEEP | Production_Items | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-production-stock.ts:16<br>app\admin\production\actions.ts:21<br>app\admin\production\actions.ts:69<br>app\admin\production\actions.ts:70 |
| KEEP | Production_Orders | 1000x26 | Referenced by code with exact sheet name. | scripts\audit-production-stock.ts:15<br>app\admin\production\actions.ts:20<br>app\admin\production\actions.ts:59<br>app\admin\production\actions.ts:62 |
| KEEP | products | 1000x26 | Referenced by code through a case/style variant; Google Sheets ranges are serving this tab. | scripts\test-void-order-v2.ts:17<br>scripts\test-submit-order-v2.ts:29<br>scripts\test-pnl-v2.ts:22<br>scripts\test-edit-order-v2.ts:19<br>scripts\migrate-orders-to-v2.ts:76<br>+18 more |
| KEEP | Promotions | 997x26 | Referenced by code with exact sheet name. | scripts\test-submit-order-v2.ts:33<br>scripts\remigrate-per-audit.ts:17<br>scripts\reaudit-orders-promo-window.ts:42<br>scripts\migrate-orders-to-v2.ts:80<br>scripts\migrate-line-discount-split.ts:49<br>+16 more |
| KEEP | Purchase_Order_Lines | 973x26 | Referenced by code with exact sheet name. | scripts\reprocess-all-po-ledger.ts:34<br>scripts\migrate-units-to-ids.ts:50<br>scripts\migrate-units-to-ids.ts:56<br>scripts\audit-water-sugar-transition.ts:21<br>scripts\audit-purchase-ledger.ts:31<br>+18 more |
| KEEP | Purchase_Orders | 999x26 | Referenced by code with exact sheet name. | lib\sheet-usage-audit.test.ts:9<br>scripts\update-po-headers.js:27<br>scripts\reprocess-all-po-ledger.ts:33<br>scripts\migrate-data.ts:117<br>scripts\migrate-data.ts:122<br>+9 more |
| KEEP | Purchase_Sources | 1000x10 | Referenced by code with exact sheet name. | app\admin\inventory\purchase-orders\actions.ts:178<br>app\admin\inventory\purchase-orders\actions.ts:179<br>app\admin\inventory\purchase-orders\[id]\page.tsx:17<br>app\admin\inventory\purchase-orders\new\page.tsx:14 |
| KEEP | purchased_items | 1000x26 | Referenced by code through a case/style variant; Google Sheets ranges are serving this tab. | scripts\reprocess-all-po-ledger.ts:35<br>scripts\audit-water-sugar-transition.ts:22<br>scripts\audit-purchase-ledger.ts:32<br>scripts\apply-purchase-ledger-cleanup.ts:29<br>app\admin\inventory\actions.ts:130<br>+10 more |
| KEEP | Recipes | 1000x26 | Referenced by code with exact sheet name. | scripts\update-btp-dates.ts:9<br>scripts\update-btp-dates.ts:25<br>scripts\test-submit-order-v2.ts:34<br>scripts\migrate-orders-to-v2.ts:81<br>scripts\investigate-dao-mieng.ts:17<br>+21 more |
| KEEP | semi_products | 1000x26 | Referenced by code through a case/style variant; Google Sheets ranges are serving this tab. | scripts\migrate-orders-to-v2.ts:121<br>scripts\investigate-negative-stock.ts:19<br>scripts\investigate-dao-mieng.ts:18<br>scripts\check-sp-yields.ts:7<br>scripts\check-semi-product-usage.ts:29<br>+22 more |
| KEEP | Stock_Adjustments | 1000x26 | Referenced by code with exact sheet name. | app\admin\inventory\actions.ts:411<br>app\admin\inventory\actions.ts:416<br>app\admin\inventory\actions.ts:453<br>app\admin\inventory\actions.ts:460<br>app\admin\reports\stock\page.tsx:22 |
| KEEP | Stock_Ledger | 4019x26 | Referenced by code with exact sheet name. | lib\sheets-db-v2.ts:60<br>lib\sheets-db-v2-edit.ts:89<br>lib\sheet-usage-audit.test.ts:8<br>scripts\test-void-order-v2.ts:44<br>scripts\test-submit-order-v2.ts:37<br>+69 more |
| KEEP | Suppliers | 1000x26 | Referenced by code with exact sheet name. | scripts\migrate-data.ts:109<br>scripts\migrate-data.ts:112<br>scripts\migrate-data.ts:113<br>app\admin\page.tsx:29<br>app\admin\inventory\purchase-orders\actions.ts:18<br>+2 more |
| KEEP | Units | 999x10 | Referenced by code with exact sheet name. | scripts\migrate-units-to-ids.ts:8<br>scripts\migrate-data.ts:23<br>scripts\migrate-data.ts:33<br>scripts\migrate-data.ts:34<br>scripts\migrate-data.ts:42<br>+29 more |
| KEEP | UOM_Conversions | 997x26 | Referenced by code with exact sheet name. | scripts\reprocess-all-po-ledger.ts:36<br>scripts\migrate-units-to-ids.ts:28<br>scripts\migrate-units-to-ids.ts:45<br>scripts\audit-purchase-ledger.ts:33<br>scripts\apply-purchase-ledger-cleanup.ts:30<br>+23 more |
| KEEP | users | 998x26 | Referenced by code with exact sheet name. | app\actions\auth.ts:20<br>app\actions\auth.ts:57 |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Finished_Product_Prices | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Finished_Product_Recipes | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Finished_Products | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Inventory_Batches | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Inventory_Transactions | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_order_counters | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Order_Lines_BACKUP_PRE_WS5_2026-06-19 | 1156x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Order_Lines-Backup-2026-06-17 | 1162x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Order_Lines-Backup-PhaseE | 1160x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Orders_BACKUP_PRE_WS5_2026-06-19 | 1349x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Orders-Backup-2026-06-17 | 1351x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Orders-Backup-PhaseE | 1349x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_outlets | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Permissions | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_PO_Items | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_POS_Order_Items | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_POS_Orders | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Product_Brands | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_product_recipes | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_raw_materials | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_semi_product_recipes | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_settings | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Spoilage_Items | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Spoilage_Orders | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Stock_Ledger_BACKUP_PRE_WS5_2026-06-19 | 2925x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_Stocktake_Records | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_supplies | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
| ARCHIVE_CANDIDATE | ZZ_ARCHIVE_User_Brands | 1000x26 | Name looks like backup/legacy/copy sheet and no direct code reference was found. |  |
