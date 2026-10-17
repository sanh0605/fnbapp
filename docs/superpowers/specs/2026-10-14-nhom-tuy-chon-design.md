# Nhóm tuỳ chọn: thiết kế

Audit F5. The owner chose 2026-10-14 to have a page of its own, "Nhóm tuỳ chọn", where he adds, edits, stops and orders the option groups the till shows. Later the same day he reopened the model, and it now follows how the large tills do it (see "The model").

## Hiện trạng (đo 2026-10-14 trên máy chủ)

1. **States.** Today a group is only the free text `modifiers.group_name`. It has no state of its own. Each option is `ACTIVE` or stopped.
2. **Buttons.** `ModifierForm.tsx` offers four hardcoded names: Thêm Topping, Chọn Size, Chọn Đường, Chọn Đá. The "Bán độc lập" switch shows only when the name is exactly "Thêm Topping". Three places check that literal:
   - `ModifierForm.tsx:114`;
   - `StandaloneToppingSwitch.tsx`;
   - migration 0100's `create_standalone_topping_product_atomic`.
3. **Lists.** The till (`POSScreen.tsx:272`, `ItemConfigModal.tsx`) shows every active option, grouped by name, on every dish, with +/− buttons and no cap. That includes Khoai lang, Trứng luộc and the 8 Topping dishes themselves. Sửa đơn (`OrderEditForm.tsx:131`) does the same.
4. **Inputs.** The group name is a select of the four names above.
5. **Data served.**
   - All 8 options are in "Thêm Topping", for example Trân châu trắng 5.000đ, Kem muối 4.000đ and Kem muối phô mai 6.000đ.
   - 322 of 4.824 order lines ever sold carry options. All 322 are drinks: Cà phê 169, Giải trí 71, Trà 58, Yogurt 24.
   - The sold snapshot (`order_lines_v2.modifiers_snapshot_json`) keeps id, name and price, one entry per portion, and not the group. Reports (`sales-actions.ts`, `pnl-actions.ts`) never read the group.
   - The app has no recipe table, so options change only the price, never the stock or the cost.
   - The till prints no ticket. Options are shown on the cart line (`CartPanel.tsx:271`) and on the order page.

Looked at: the files named above, `app/pos/page.tsx`, `app/pos/actions.ts`, `app/admin/products/modifiers/actions.ts`, and migrations 0097, 0098 and 0100. Not looked at yet: the POS offline cache code and the service worker. The plan must read them before Task POS.

## The owner's choices (2026-10-14)

| # | Question | Answer |
|---|---|---|
| 1 | Which dishes a group applies to | "Anh chọn từng món": each group lists the dishes it applies to |
| 3 | Which groups may sell an option on its own | "Mỗi nhóm có công tắc": a "Cho bán riêng" box per group. Thêm Topping starts on, new groups start off |
| 5 | Where a group is attached to a dish | "Cả hai chỗ": on the group page and on Sửa món, both editing the same data |
| 6 | Which dishes get Thêm Topping on day one | "Chỉ đồ uống": every dish in Cà phê, Giải trí, Trà, Yogurt and Cacao |
| 7 | The model itself | "Dùng khung chuẩn". This replaces his answers 2 ("Mỗi nhóm tự đặt" Chọn một / Chọn nhiều) and 4 ("Không bắt buộc") |

**Answer 7.** Shown a first example, the owner said: *"Phải hiện mức đường trước rồi mới thêm topping, nhưng anh nghĩ lại tất cả việc thêm topping hay thêm đường hay đổi sữa đều phải lên lại logic … em đang dựa theo đó mà làm chứ không đề xuất lại cho anh cách phù hợp hơn"*. He was right: the questions extended today's code. The large tills were looked up the same day:
- **Square.** Each set is required or not, and single or multiple choice, with a minimum and a maximum. The default is marked on the option. ([Square help 5119](https://squareup.com/help/us/en/article/5119))
- **Toast.**
  - A group is optional or required. A multi-choice group has a cap and may allow one option more than once.
  - A swap is charged only the difference. ([Toast: Configure Modifier Behavior](https://support.toasttab.com/en/article/Required-Optional-Modifiers))
- **StoreKit.** Separates the cap on the group from the cap on each option. ([StoreKit multi-max](https://storekit.com/docs/guides/menu/multi-max))

## The model

The example the owner approved is one Trà sữa truyền thống at 18.000đ. The till shows the groups in making order:

1. **MỨC ĐƯỜNG**: Chọn một. Ít đường • **Bình thường (sẵn)** • Nhiều đường.
2. **MỨC ĐÁ**: Chọn một. Ít đá • **Bình thường (sẵn)** • Không đá.
3. **LOẠI SỮA**: Chọn một. **Sữa tươi (sẵn) 0đ** • Sữa yến mạch +8.000đ.
4. **THÊM TOPPING**: Chọn nhiều, at most 3 portions in all, each kind at most x2.

A customer ordering normally needs no extra tap: the defaults are already lit when the dish opens (since 2026-10-17 every dish with choices opens before it goes into the cart, `BR-SALE-019`). Oat milk makes the cup 26.000đ. The cart line and the order page show only what differs from the defaults: "Ít đường, Sữa yến mạch, +Trân châu trắng x2".

### Group settings (the owner sets each one on the group page)

| Setting | Values | Rule |
|---|---|---|
| Tên | text, not blank | Unique among groups that are not erased, ignoring case |
| Kiểu chọn | Chọn một / Chọn nhiều | — |
| Tối đa mấy phần | blank = no cap, or an integer 1–20; Chọn nhiều only | Total portions across the group |
| Cho bán riêng | yes / no; Chọn nhiều only | Rule 3 below |
| Thứ tự hiện | an integer 1–99 | Ties sort by name |
| Món áp dụng | tick list, by dish group, with "Chọn cả nhóm" | Answers 1 and 5 |

### Option settings (on the option form)

- **Nhóm**: a Select of the groups that are not erased.
- **Giá**: the money the option adds to the cup. A swap is just an option with a dearer price than the default (Sữa yến mạch +8.000đ against Sữa tươi 0đ). No substitution arithmetic is needed.
- **Có sẵn**: at most one per Chọn một group. Ticking it on one option clears it on the others in that group, in the same save.
- **Tối đa mỗi món**: Chọn nhiều only; blank means no cap, otherwise an integer 1–20.

**No "Bắt buộc" box.** The example showed sugar and ice as required. Since a Chọn một group with a default is always answered, the box would change nothing on the till, so it was left out (ponytail, owner rule 2026-10-14). A group with no default stays optional, as the owner chose in answer 4.

## Data

- **`modifier_groups`**
  - `id`, made by `generateNewId` (`MG-001`).
  - `name`.
  - `selection_mode`, either `ONE` or `MANY`.
  - `max_total` integer, nullable.
  - `allow_standalone` boolean.
  - `sort_order` integer.
  - `status`, either `ACTIVE` or `INACTIVE`.
  - `created_at` and `updated_at`.
  - Checks: `allow_standalone` is false and `max_total` is null when the mode is `ONE`.
- **`modifier_group_products`**: `id` (the backup and `findAll` page by it), `group_id` and `product_id`, unique on the pair, both `ON DELETE CASCADE`: a tick is settings with no history, so erasing a never-sold dish or an empty group takes its ticks with it. Unticking deletes the row.
- **`modifiers`** gains three columns:
  - `group_id`, referencing the group, `RESTRICT`; not null from migration B;
  - `is_default` boolean, with a partial unique index on (`group_id`) where it is true;
  - `max_qty` integer, nullable.
- **What a sale stores.** A sold line stores only the options picked away from the defaults, one entry per portion, as today. A plain cup stores none, exactly like the 4.502 plain lines already sold, and reports stay unchanged. The cost is that a later change of default does not rewrite old orders; they meant the default of their day.
- **What edits affect.** Edits change only what the till shows from then on. Nothing is recomputed.

## Rules

1. **Till behaviour.**
   - A Chọn một group opens with its default lit. Tapping another option moves the pick; tapping the lit option again goes back to the default, or to nothing when the group has none.
   - A Chọn nhiều group keeps +/−. "+" greys out at the option's cap or the group's cap.
2. **Stopping and erasing.**
   - A stopped group and its options disappear from the till, Sửa món and Sửa đơn. Its options and dish ticks stay, so "Dùng lại" restores it.
   - Only `ADMIN` erases a group (`requireOwner()`), and only an empty one. Postgres refuses otherwise, and the refusal is shown in Vietnamese naming the options. An option marked `DELETED` still belongs to its group, so it counts.
3. **"Cho bán riêng".**
   - Turning it off is refused while an option in the group is sold on its own, naming those dishes (for example "Trân châu trắng").
   - Moving such an option into a group that does not allow it is refused the same way.
   - Migration 0100's function reads `allow_standalone` instead of the name. Every hardcoded "Thêm Topping" goes.
4. **Order.** The till and the group page list groups by `sort_order` and then by name. The cart line and the order page list the stored picks as today.
5. **Dishes.**
   - A new dish starts with no group.
   - Saving a dish together with its ticks, or a group together with its ticks, writes two tables, so it goes through one Postgres function.
   - Saving an option's "Có sẵn" also goes through one function, because it clears the others in the group.
6. **Server intake** checks prices as today but does not refuse an option that is no longer attached, or a count over a cap. An order the till queued offline before the owner changed the group must still save.
7. **Sửa đơn** applies the same groups, defaults and caps as the till. An option already on the line but no longer attached stays shown and ticked, so a save never drops it silently.
8. **Who may do what.** The group page uses the same guard as Topping & Tuỳ chọn.

## Screens

- **Menu.** Under Bán hàng, "Nhóm tuỳ chọn" sits next to "Topping & Tuỳ chọn".
- **Pages.** List, create, detail and edit. They are pages, not popups (`BR-DATA-007`), and follow the shared templates, with a desktop and a phone layout each (`.claude/rules/ui-devices.md`).
- **Till.** `ItemConfigModal` gets the Chọn một buttons and the greyed "+".
- **Who builds what.** Gemini builds the screens and the till dialog; Sonnet builds the tables, functions and server actions, as two separate tickets.

## Rollout: two migrations, never ahead of the code

1. **Migration A (0119) runs before the deploy.** The live code still reads and writes `group_name` and calls the same functions with the same arguments. That keeps working because this step only adds, and no function's return changes:
   - adds the tables and columns; `group_id` stays nullable for now, since the live code inserts options without it;
   - creates "Thêm Topping": `MANY`, no caps, `allow_standalone` true, `sort_order` 50, so groups the owner adds later with lower numbers come before it;
   - sets every option's `group_id` from its name;
   - ticks every non-deleted dish whose dish group's type is a drink (`product_types.is_drink`, which today means Cà phê, Giải trí, Trà, Yogurt and Cacao), re-measured that day;
   - switches 0100's check to the option's group;
   - adds `save_modifier_atomic` and `save_modifier_group_atomic`;
   - replaces `save_product_atomic` with the same function plus an optional last argument for the dish's groups. It is dropped and recreated so that no second version exists to confuse a call. A call without the argument leaves the ticks alone.
2. **The deploy.** The new code reads `group_id` and the links and writes through the new functions. On day one the till behaves as today, except that only drinks show toppings.
3. **Migration B (written 2026-10-15 as `0120_modifier_group_required.sql`, ran on the server 2026-10-15 with the owner's approval) is written only after the deploy is checked**, so a push cannot carry it along early. It sets `group_id` from the name for any option the old code made in between, makes `group_id` not null, drops `modifiers.group_name`, and takes the group argument out of `sync_topping_price_atomic`, which by then only `save_modifier_atomic` calls.

**Cost to state before running:**
- A till still holding the old page shows every option on every dish until it reloads. It does not stop taking orders.
- An option added on the old page between migration A and the deploy has no group: its Bán độc lập is refused, and after the deploy the till does not show it until migration B gives it one. Run the deploy right after migration A and add no option in between.
- Measured 2026-10-14 before running: 9 options, one spelling "Thêm Topping"; 35 live drink dishes get ticked, the 8 Topping dishes and 2 food dishes do not.

## Testing

- **Failing tests first**, one per rule. They include:
  - the default is picked on open;
  - Chọn một moves the pick;
  - "+" stops at x2 and at 3 in all;
  - only the non-default picks are stored and shown;
  - "Có sẵn" on a second option clears the first;
  - turning off "Cho bán riêng" is refused, naming Trân châu trắng;
  - an unattached option survives Sửa đơn;
  - erasing a group that has options is refused in Vietnamese.
- **Migration A text test.** It leaves 0 options without a group and ticks only the five drink groups.
- **After migration A on the server**, measure and report with the denominators:
  - options without a group (expected 0 of 9 rows, the erased Dâu sấy row included);
  - dishes ticked, per dish group;
  - drinks without Thêm Topping (expected 0).
- **Turn the todo into a test.** The `it.todo` in `ModifierForm.test.tsx` becomes a passing test.
