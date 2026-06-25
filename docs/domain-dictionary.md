# Domain Dictionary

Date: 2026-06-25
Repo: `fnbapp`

## Purpose

This file is the shared vocabulary for product, code, Google Sheets, reports, audit scripts, and Vietnamese UI labels.

Rules:

- One business concept should have one preferred Vietnamese label and one preferred code term.
- Historical data uses snapshots. Current reference data must not silently rewrite historical meaning.
- Ledger terms are accounting terms in this app. Do not use them for temporary UI state.
- When a new feature introduces a new concept, update this file before or during implementation.

## Core Entities

| Concept | Vietnamese UI label | Code term | Current storage | Meaning |
| --- | --- | --- | --- | --- |
| Order | Đơn hàng | `Order` / `OrderV2` | `Orders_V2` | A completed, voided, or superseded sale transaction. |
| Order line | Dòng đơn | `OrderLine` / `OrderLineV2` | `Order_Lines_V2` | One sold product variant plus its modifiers, discounts, recipe snapshot, and COGS. |
| Order event | Sự kiện đơn | `OrderEvent` | `Order_Events` | Audit log for create, edit, void, and lifecycle events. |
| Cart | Giỏ hàng | `CartInput` | UI/local action input | Temporary checkout input before an order is written. |
| Product | Món | `Product` | `Products` / `products` | Sellable menu item, such as Cà phê đá. |
| Variant | Size | `Variant` | `Product_Variants` | Sellable size/variant of a product, with its own price. |
| Modifier | Tùy chọn | `Modifier` | `Modifiers` | Add-on or customization on a line, such as 20ml cốt cà phê. |
| Promotion | Khuyến mãi hệ thống | `Promotion` | `Promotions` | System-managed discount rule applied by product/order conditions. |
| Manual item discount | Giảm từng món | `manual_item_discount` | `Order_Lines_V2` | Cashier/admin discount applied to one line. |
| Manual order discount | Giảm toàn đơn | `manual_order_discount` | `Orders_V2` | Cashier/admin discount applied to the whole order. |
| Order discount allocation | Phân bổ giảm toàn đơn | `order_discount_allocation` | `Order_Lines_V2` | The portion of order-level discount assigned to each line. |
| Staff free drink | Đồ uống miễn phí nhân viên | manual full discount | `Orders_V2`, `Order_Lines_V2` | Valid business case: gross and COGS remain, net revenue becomes 0. |

## Inventory Entities

| Concept | Vietnamese UI label | Code term | Current storage | Meaning |
| --- | --- | --- | --- | --- |
| Base ingredient | Nguyên liệu gốc | `BaseIngredient` | `Base_Ingredients` | Inventory item consumed directly, such as sữa, bột, nước đường Glofood. |
| Semi-product | Bán thành phẩm | `SemiProduct` | `Semi_Products` / `semi_products` | Prepared ingredient produced or consumed, such as cốt cà phê. |
| Purchased item | Hàng mua vào | `PurchasedItem` | `Purchased_Items` / `purchased_items` | Supplier-facing item bought through purchase orders. |
| Purchase order | Phiếu nhập hàng | `PurchaseOrder` | `Purchase_Orders` | Header for goods received from supplier. |
| Purchase order line | Dòng nhập hàng | `PurchaseOrderLine` | `Purchase_Order_Lines` | One purchased item, purchased unit, quantity, subtotal, and conversion reference. |
| Unit | Đơn vị | `Unit` | `Units` | Unit of measure, such as g, ml, chai, hộp. |
| Unit conversion | Quy đổi đơn vị | `UOMConversion` | `UOM_Conversions` | Maps purchased item + purchased unit to base unit quantity. |
| Purchase source | Nguồn nhập hàng | `PurchaseSource` | `Purchase_Sources` | Marketplace/vendor channel, such as Shopee or Lazada. |
| Supplier | Nhà cung cấp | `Supplier` | `Suppliers` | Supplier/vendor entity. |
| Production order | Lệnh nấu | `ProductionOrder` | `Production_Orders` | Produces a semi-product from ingredients. |
| Production item | Thành phẩm nấu | `ProductionItem` | `Production_Items` | Quantity of semi-product produced by a production order. |
| Stock adjustment | Điều chỉnh tồn | `StockAdjustment` | `Stock_Adjustments`, `Stock_Ledger` | Manual correction with reason. Used for audit fixes or real stock count deltas. |
| Non-inventory ingredient | Phi lưu kho | `is_non_inventory` | `Base_Ingredients` | Ingredient consumed conceptually but not tracked as stock. Audits should not report it as negative stock. |

## Status Terms

| Status | Applies to | Vietnamese label | Meaning |
| --- | --- | --- | --- |
| `DRAFT` | Purchase order | Nháp | Editable, does not affect stock ledger. |
| `COMPLETED` | Order, purchase order | Hoàn thành | Final active business record. For PO, stock is received. For order, sale is active. |
| `SUPERSEDED` | Order | Đã được thay thế | Historical order version replaced by a newer edit. Must not count as active revenue/stock demand. |
| `VOIDED` | Order | Đã hủy | Cancelled order. Revenue excluded; stock should be reversed. |
| `ACTIVE` | Reference data | Đang dùng | Available for new transactions. |
| `INACTIVE` | Conversion/reference data | Ngưng dùng | Hidden from new transactions, preserved for history. |
| `DELETED` | Reference data | Đã xóa | Soft-deleted from UI lists. Must not remove history. |

## Ledger Contract

`Stock_Ledger` is the source of truth for inventory movement. Current stock is the sum of all ledger rows for an item, excluding non-inventory items from tracked-stock reporting.

| Transaction type | Vietnamese label | Quantity sign | Meaning |
| --- | --- | ---: | --- |
| `PO_RECEIPT` | Nhập hàng | Positive | Stock received from completed purchase order. |
| `SALES_CONSUME` | Bán hàng trừ kho | Negative | Ingredients or semi-products consumed by a completed order version. |
| `EDIT_REVERSAL` | Hoàn ledger khi sửa/hủy | Usually positive | Reverses previous `SALES_CONSUME` rows when an order is edited or voided. |
| `PRODUCTION_CONSUME` | Nấu trừ nguyên liệu | Negative | Base ingredients consumed to produce semi-product. |
| `PRODUCTION_YIELD` | Nấu cộng bán thành phẩm | Positive | Semi-product quantity produced. |
| `STOCK_ADJUST` | Điều chỉnh tồn | Positive or negative | Manual correction or audit adjustment. Must have an auditable reason/reference. |

Ledger rules:

- Do not edit old ledger rows for normal business changes. Add reversing/correction rows.
- Order edit creates a new order version and ledger reversal for the old version.
- Purchase order edit removes/rebuilds PO receipt rows only for that PO after validation.
- Audit scripts must include `EDIT_REVERSAL` and `STOCK_ADJUST` when calculating current balances.
- Production audits must distinguish historical negative periods from current negative stock.

## Snapshot Policy

Snapshots freeze business meaning at the time of sale.

| Snapshot | Stored on | Meaning |
| --- | --- | --- |
| `product_snapshot_json` | Order line | Product name/category at sale time. |
| `variant_snapshot_json` | Order line | Size and price at sale time. |
| `modifiers_snapshot_json` | Order line | Modifier name, price, and quantity at sale time. |
| `promotion_snapshot_json` | Order/order line | Promotion rule at sale time. |
| `recipe_snapshot_json` | Order line | Product/modifier recipe at sale time. |
| `unit_price_snapshot` | Cart/edit input | Submitted line unit price to preserve historical price on edit. |
| `promo_discount_snapshot` | Cart/edit input | Submitted line promotion discount to preserve historical promo on edit. |

Rules:

- Editing an old order must not silently pull current product price, modifier price, promotion, or recipe for unchanged historical lines.
- New lines added during edit may use current reference data.
- Changed modifiers should create a new snapshot for that changed selection.
- COGS uses the stored historical cost on existing lines. After the 2026-06-25 MAC decision, new and edited lines should use MAC at the relevant sale time unless a future lot-level FIFO design is approved.

## Purchase Conversion Policy

Preferred source of truth: `Purchase_Order_Lines.conversion_id`.

Rules:

- A completed PO line for a base ingredient must have a valid `conversion_id`.
- `conversion_id` must belong to the same `purchased_item_id` as the line.
- If historical data lacks `conversion_id`, audit may backfill only when there is exactly one matching conversion for purchased item + unit.
- If multiple conversions match, audit must report ambiguity and refuse to guess.
- A conversion referenced by historical PO lines must not have core fields changed. Create a new conversion instead.
- Deleting a referenced conversion should mark it `INACTIVE`, not remove it.

## COGS Terms

| Concept | Vietnamese UI label | Code term | Meaning |
| --- | --- | --- | --- |
| COGS | Giá vốn | `cost_at_sale` | Cost of goods sold stored per order line. |
| MAC | Bình quân gia quyền | MAC/weighted average cost | Preferred COGS valuation method for P&L after the 2026-06-25 architecture decision. |
| FIFO | Nhập trước xuất trước | `FIFOTracker` | Optional audit/debug costing method. Not the primary P&L contract unless a future lot-level design is approved. |
| COGS drift | Lệch giá vốn | `cogs drift` | Stored `cost_at_sale` differs from the accepted COGS valuation contract. |

Rules:

- POS create and admin edit must use the same MAC logic.
- Reports should read stored line COGS unless explicitly auditing/recalculating.
- FIFO audits are secondary checks only; quantity stock control does not depend on FIFO.
- COGS audit is read-only unless an apply script is explicitly run.

## Reporting Terms

| Concept | Vietnamese UI label | Meaning |
| --- | --- | --- |
| Gross revenue | Doanh thu gốc | Sum before discounts. |
| Net revenue | Doanh thu thuần | Amount customer pays after all discounts. |
| System promotion total | Tổng khuyến mãi hệ thống | Total promotion discount. |
| Manual discount total | Tổng giảm thủ công | Manual item + manual order discounts. |
| Gross profit | Lợi nhuận gộp | Net revenue minus COGS. |
| Free drink order | Đơn miễn phí | Net revenue 0, but still has COGS and stock consumption. |

Rules:

- `SUPERSEDED` and `VOIDED` orders must not count as active revenue.
- Staff free drinks are valid orders with net revenue 0 and positive COGS.
- Date range logic must use Asia/Saigon business dates when presenting reports.

## UI Vocabulary

Preferred Vietnamese labels:

| Concept | Preferred label | Avoid mixing with |
| --- | --- | --- |
| Modifier | Tùy chọn | Topping, Modifier, Option mixed randomly |
| Modifier group | Nhóm tùy chọn | Nhóm topping unless context is legacy |
| Product | Món | Hàng hóa when in menu context |
| Purchased item | Hàng mua vào | Món |
| Base ingredient | Nguyên liệu gốc | Hàng mua vào |
| Semi-product | Bán thành phẩm | Nguyên liệu gốc |
| Purchase order | Phiếu nhập hàng | Đơn đặt hàng if the flow means received inventory |
| Order | Đơn hàng | Phiếu |
| Void order | Hủy đơn | Xóa đơn |
| Edit order | Sửa đơn | Cập nhật đơn when versioning matters |

## Sheet Naming Notes

Some operational Google Sheet tabs are lowercase but are served through code ranges that use PascalCase aliases.

Known sensitive tabs:

- `brands`
- `orders`
- `products`
- `purchased_items`
- `semi_products`

Rule: do not rename, archive, or delete these tabs unless the code references and audits are updated in the same phase.

## Audit Vocabulary

| Audit term | Meaning |
| --- | --- |
| mismatch | Actual data differs from expected model. |
| orphan | A ledger or child row references a missing parent. |
| drift | Stored historical value differs from recomputed value. |
| ambiguous | More than one valid candidate exists; script must not guess. |
| safe backfill | Missing historical ID can be restored because there is exactly one valid candidate. |
| current stock | Final balance after all ledger rows. |
| negative period | A historical time window where balance was below zero. |
| non-inventory | Excluded from tracked stock alarms. |

## Open Vocabulary Decisions

These still need tightening during future phases:

- Whether UI should display `Tùy chọn` everywhere and reserve `Topping` only for legacy group names.
- Whether purchase order should be called `Phiếu nhập hàng` everywhere instead of mixed `Đơn đặt hàng`.
- Whether `STOCK_ADJUST` rows from audit cleanup need a separate subtype such as `AUDIT_ADJUST`.
- Whether staff free drink orders should get an explicit reason/category field instead of relying on manual full discount.
