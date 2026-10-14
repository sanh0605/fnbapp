# Nhóm tuỳ chọn: thiết kế

Audit F5. The owner chose 2026-10-14 to have a page of its own, "Nhóm tuỳ chọn", where he adds, edits, stops and orders the option groups the till shows. This spec records his six answers from that day and the technical choices made around them.

## Hiện trạng (đo 2026-10-14 trên máy chủ)

1. **States.** Today a group is only the free text `modifiers.group_name`. It has no state of its own. Each option is `ACTIVE` or stopped.
2. **Buttons.** `ModifierForm.tsx` offers four hardcoded names: Thêm Topping, Chọn Size, Chọn Đường, Chọn Đá. The "Bán độc lập" switch shows only when the name is exactly "Thêm Topping". Three places check that literal:
   - `ModifierForm.tsx:114`;
   - `StandaloneToppingSwitch.tsx`;
   - migration 0100's `create_standalone_topping_product_atomic`.
3. **Lists.** The till (`POSScreen.tsx:272`, `ItemConfigModal.tsx`) shows every active option, grouped by name, on every dish, with +/− buttons. That includes Khoai lang, Trứng luộc and the 8 Topping dishes themselves. Sửa đơn (`OrderEditForm.tsx:131`) does the same.
4. **Inputs.** The group name is a select of the four names above.
5. **Data served.**
   - All 8 options are in "Thêm Topping", for example Trân châu trắng 5.000đ, Kem muối 4.000đ and Kem muối phô mai 6.000đ.
   - 322 of 4.824 order lines ever sold carry options. All 322 are drinks: Cà phê 169, Giải trí 71, Trà 58, Yogurt 24.
   - The sold snapshot (`order_lines_v2.modifiers_snapshot_json`) keeps id, name and price, not the group. Reports (`sales-actions.ts`, `pnl-actions.ts`) never read the group.

Looked at: the files named above, `app/pos/page.tsx`, `app/pos/actions.ts`, `app/admin/products/modifiers/actions.ts`, and migrations 0097, 0098 and 0100. Not looked at yet: the POS offline cache code and the service worker. The plan must read them before Task POS.

## The owner's choices (2026-10-14)

| # | Question | Answer |
|---|---|---|
| 1 | Which dishes a group applies to | "Anh chọn từng món": each group lists the dishes it applies to |
| 2 | How a customer picks inside a group | "Mỗi nhóm tự đặt": each group is either **Chọn một** or **Chọn nhiều** |
| 3 | Which groups may sell an option on its own | "Mỗi nhóm có công tắc": a "Cho bán riêng" box per group. Thêm Topping starts on, new groups start off |
| 4 | Must the cashier pick in a Chọn một group | "Không bắt buộc": skipping means the drink is made the normal way |
| 5 | Where a group is attached to a dish | "Cả hai chỗ": on the group page and on Sửa món, both editing the same data |
| 6 | Which dishes get Thêm Topping on day one | "Chỉ đồ uống": every dish in Cà phê, Giải trí, Trà, Yogurt and Cacao |

## Approaches

- **A. Group table, a dish-link table, and a foreign key from each option. Chosen.** Renaming a group touches one row, and Postgres refuses orphaned links by itself.
- **B. Group table keyed by its name, with options still holding the text.** Rejected: a rename must rewrite every option, and a typo creates a second group silently.
- **C. No groups, a per-dish list of options.** Rejected: it drops the group the owner chose, and the till could not order or label options.

## Data

- **`modifier_groups`**
  - `id` text, `MG-001` style, made by `generateNewId` as for options.
  - `name` text, not blank, unique among non-deleted groups (case-insensitive).
  - `selection_mode` text, either `ONE` or `MANY`.
  - `allow_standalone` boolean, default false. A check refuses true when the mode is `ONE`.
  - `sort_order` integer ≥ 1.
  - `status`, either `ACTIVE` or `INACTIVE`.
  - `created_at` and `updated_at`.
- **`modifier_group_products`**: `group_id` and `product_id`, both `RESTRICT`, primary key on the pair. Unticking a dish deletes its row. This is settings with no history, and the rows sold keep their own snapshot.
- **`modifiers.group_id`**: references `modifier_groups`, `RESTRICT`, not null after the backfill.
- **What edits affect.** Changing a group changes only what the till shows from then on. Orders already sold keep the option names and prices written at sale time. Nothing is recomputed.

## Rules

1. **Chọn một.** On the till, tapping an option selects it and clears the others in that group, and tapping it again clears it. **Chọn nhiều** keeps today's +/− buttons.
2. **Stopping a group.** A stopped group and its options disappear from the till, Sửa món and Sửa đơn. The options stay in the group and its dishes stay ticked, so "Dùng lại" restores everything. Only `ADMIN` may erase a group, and only an empty one: Postgres refuses while an option points at it. That refusal is shown in Vietnamese and names the options.
3. **"Cho bán riêng"** shows only on Chọn nhiều groups.
   - Turning it off is refused while an option in the group is sold on its own. The message names those dishes, for example "Trân châu trắng".
   - Moving an option that is sold on its own into a group that does not allow it is refused the same way.
   - Rules 1, 3 and 4 replace every hardcoded "Thêm Topping": migration 0100's function reads `allow_standalone` instead.
4. **Order on the till.**
   - Groups appear by `sort_order` and then by name. The group page lists them the same way and has a "Thứ tự hiện" number box.
   - Options inside a group appear in today's order.
5. **Dishes.**
   - The group page shows the dishes under their dish groups, each dish with a tick box, plus "Chọn cả nhóm" per dish group.
   - Sửa món has a "Nhóm tuỳ chọn" tick list.
   - A new dish starts with no group.
   - Saving a dish together with its ticks writes two tables, so it goes through one Postgres function.
6. **Server intake** does not refuse an option that is no longer attached to the dish. An order the till queued offline before the owner unticked it must still save, and its price comes from the server as today.
7. **Sửa đơn** shows the groups attached to that dish. An option already on the line but no longer attached stays shown and ticked, so saving never drops it silently.
8. **Who may do what.** The group page uses the same guard as Topping & Tuỳ chọn for add, edit and stop. Erasing a group is `ADMIN` only, through `requireOwner()`.

## Screens

- **Menu.** Under Bán hàng, the entry "Nhóm tuỳ chọn" sits next to "Topping & Tuỳ chọn".
- **Pages.** List, create, detail and edit. They are pages, not popups (`BR-DATA-007`), and follow the shared list/detail/form templates. Each has a desktop and a phone layout (`.claude/rules/ui-devices.md`).
- **Option form.** The "Nhóm" box becomes a Select of the active groups.
- **Order of building.** Gemini builds the screens and Sonnet builds the data and server side, as two separate tickets.

## Rollout: two migrations, never ahead of the code

1. **Migration A runs before the deploy.** The code live today still reads `group_name`, and that keeps working because this step only adds.
   - It creates both tables.
   - It creates group "Thêm Topping": `MANY`, `allow_standalone` true, `sort_order` 1.
   - It sets every option's `group_id`.
   - It ticks every non-deleted dish in Cà phê, Giải trí, Trà, Yogurt and Cacao. Inactive dishes are included so "Bán lại" keeps their options.
   - It switches 0100's check to `allow_standalone`.
   - It adds the save functions.
2. **The deploy.** The code reads `group_id` and the links.
3. **Migration B runs after the deploy is checked.** It drops `modifiers.group_name` and moves migration 0098's sync function off it.

The dish count in step 1 is measured again on the day it runs, not taken from this spec. **Cost to state before running:** between the deploy and the till reloading, a till holding the old page keeps today's behaviour, which shows every option on every dish. It does not stop taking orders.

## Example to confirm with the owner

The owner creates group "Mức đường" as **Chọn một**, with "Cho bán riêng" off, "Thứ tự hiện" 2 and options Ít đường 0đ and Nhiều đường 0đ, and ticks only Trà sữa truyền thống.

On the till:
- Trà sữa truyền thống shows THÊM TOPPING first (+/−), then MỨC ĐƯỜNG, where tapping Ít đường and then Nhiều đường leaves only Nhiều đường.
- Cà phê sữa shows only THÊM TOPPING.
- Khoai lang shows no options.

## Testing

- **Failing tests first, one per rule above.** They include:
  - Chọn một clears its sibling.
  - Turning off "Cho bán riêng" is refused with Trân châu trắng named.
  - The till shows only the dish's groups, in order.
  - An unattached option already on an order survives Sửa đơn.
  - Erasing a group that still has options is refused in Vietnamese.
- **Migration A text test.** The backfill leaves 0 options without a group and ticks only the five drink groups.
- **After migration A on the server**, measure and report with the denominators:
  - options without a group: expected 0 of 8;
  - dishes ticked, per dish group;
  - drinks with no Thêm Topping: expected 0 out of the number of drinks.
- **Turn the todo into a test.** The `it.todo` in `ModifierForm.test.tsx` becomes a passing test.
