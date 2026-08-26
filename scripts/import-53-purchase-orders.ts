import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Implements docs/superpowers/plans/2026-08-27-import-53-purchase-orders.md.
 *
 * Imports the 53 `NH`-coded purchase orders from the owner's sheet that are
 * not yet in the system, one system order per NH code. Inputs (all
 * owner-confirmed, re-derived fresh from source on every run rather than
 * trusted from a prior session's output):
 *
 *   scratchpad/sheet2.txt      the sheet, re-downloaded after the owner's last edit
 *   scratchpad/owner-map.json  42 sheet item names -> system item names
 *   scratchpad/unit-rules.json 15 unit decisions (see below)
 *   scratchpad/todo-codes.json the 53 NH codes not yet in the system
 *
 * unit-rules.json's shape, reverse-engineered and verified against every
 * one of the 107 lines' actual UOM_Conversions rows before writing this
 * script (not assumed from the plan's prose): every purchased item already
 * has exactly one ACTIVE conversion (rate 1, except two raw-feeling
 * consumables and one weighed item). For most lines the sheet's own unit
 * word already matches that conversion's purchased_unit name exactly
 * (case/whitespace aside), so resolveConversion's own name-matching
 * (lib/purchase-ledger-rebuild.ts) finds it with zero help. The 15
 * unit-rules.json entries exist ONLY for the items where the sheet's word
 * does not match the existing conversion's name -- "use" is that
 * conversion's real purchased_unit name (after the two retitles in this
 * script's PREP step land), and "factor" multiplies the sheet's raw
 * quantity into an equivalent count in that unit (10 for "1 Combo 10" of
 * Chai nhựa HDPE 1000ml, whose only conversion is named "Chai" at rate 1;
 * 50 for "Combo ly + nắp nhựa PP", whose only conversion is named "Combo").
 * No new conversions are created; this import supplies no conversion_id
 * and lets the system's own by-name lookup do the work, exactly as if the
 * unit typed into the real form matched.
 *
 * Money math: subtotal is the sheet's own unit-price * quantity (unchanged
 * by any factor); shipping/voucher/discount/tax go on the order header,
 * never per line, and `Giá nhập thực tế` is never copied (BR-COGS-006's own
 * allocation would double it).
 *
 * Side effects reused from real production code, not reimplemented:
 *   - buildPurchaseOrderWritePlan / buildPurchaseReceipt resolve each
 *     line's conversion and compute base_quantity, unit_cost, and the
 *     stock_ledger row exactly as app/admin/inventory/purchase-orders/
 *     actions.ts does for a real form submission.
 *   - planAssetsFromCompletedOrder (lib/asset-purchase-allocation.ts) runs
 *     for every order carrying an EQUIPMENT line -- 65 of the 107 lines
 *     are EQUIPMENT, a consequence the plan's own §5 trigger table does
 *     not mention (it is application logic, not a DB trigger, but it is
 *     exactly the kind of thing fnbapp-bulk-data-change §5 says to report:
 *     completing these orders will create up to 65 new `assets` rows,
 *     each already partway through its depreciation term as of today
 *     since acquired_date is the sheet's own historical date).
 *   - findDuplicateActiveName / findDiacriticStrippedMatch
 *     (lib/duplicate-name-guard.ts) gate the 15 new suppliers exactly as
 *     app/admin/suppliers/actions.ts's addSupplier does.
 *
 * Dry-run by default; --apply writes for real. Idempotent either way: a
 * second run must find every one of the 53 NH codes already present (by
 * supplier_invoice_code where the sheet has one, by (date, supplier,
 * total) where it does not) and insert nothing.
 */

import type { Band } from "@/lib/asset-depreciation";
import { findBandForUnitPrice } from "@/lib/asset-depreciation";
import { planAssetsFromCompletedOrder, type EquipmentPurchaseLine } from "@/lib/asset-purchase-allocation";
import { buildPurchaseOrderWritePlan } from "@/lib/purchase-order-write-plan";
import {
  findDiacriticStrippedMatch,
  findDuplicateActiveName,
  duplicateNameErrorMessage,
  duplicateWarningMessage,
} from "@/lib/duplicate-name-guard";
import * as fs from "fs";
import * as path from "path";

const SCRATCHPAD = path.join(process.cwd(), "scratchpad");

// ---------------------------------------------------------------------------
// Sheet parsing -- re-derived fresh from sheet2.txt on every run, not from
// any previously-saved intermediate JSON.
// ---------------------------------------------------------------------------

function unescapeMd(s: string): string {
  return s.split("\\").join("");
}

function splitRow(line: string): string[] {
  let inner = line.trim();
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map(c => c.trim());
}

function parseVNNumber(s: string): number {
  const cleaned = unescapeMd(s).split(",").join("").trim();
  if (cleaned === "" || cleaned === "-") return 0;
  return Number(cleaned);
}

type SheetOrder = {
  code: string;
  status: string;
  dateDDMMYYYY: string;
  source: string; // "Shopee" | "Mua ngoài"
  maPhieu: string; // supplier_invoice_code candidate
  supplier: string;
  shipping: number;
  shippingDiscount: number;
  voucher: number;
  discount: number;
  credit: number;
  tax: number;
  subtotal: number;
  total: number;
};

type SheetLine = {
  orderCode: string;
  itemName: string;
  sheetQty: number;
  sheetUnit: string;
  sheetUnitPrice: number;
  category: string;
};

function parseSheet(): { orders: SheetOrder[]; lines: SheetLine[] } {
  const text = fs.readFileSync(path.join(SCRATCHPAD, "sheet2.txt"), "utf8").split("\n");

  // Order-header table: found by its own distinctive header row, not a
  // hardcoded line range -- the sheet is re-downloaded between sessions and
  // a fixed offset would silently drift onto the wrong table.
  const headerIdx = text.findIndex(l => l.includes("Mã phiếu nhập") && l.includes("Nhà cung cấp") && l.includes("Voucher"));
  if (headerIdx === -1) throw new Error("Could not find the order-header table in sheet2.txt");
  const orders: SheetOrder[] = [];
  for (let i = headerIdx + 1; i < text.length; i++) {
    const line = text[i];
    if (!line.trim().startsWith("| NH")) {
      if (line.trim() === "" || line.trim().startsWith("|  |")) break;
      continue;
    }
    const c = splitRow(line);
    orders.push({
      code: c[0],
      status: c[1],
      dateDDMMYYYY: c[2],
      source: unescapeMd(c[3]),
      maPhieu: c[4],
      supplier: unescapeMd(c[6]),
      shipping: parseVNNumber(c[8]),
      shippingDiscount: parseVNNumber(c[9]),
      voucher: parseVNNumber(c[10]),
      discount: parseVNNumber(c[11]),
      credit: parseVNNumber(c[12]),
      tax: parseVNNumber(c[13]),
      subtotal: parseVNNumber(c[14]),
      total: parseVNNumber(c[15]),
    });
  }

  // Line-detail table: the depreciation-tracking table that (verified
  // 2026-08-27) covers every non-RAW purchase, not only equipment --
  // "Công cụ dụng cụ" and "Vật tư tiêu hao" both appear in it.
  const lineHeaderIdx = text.findIndex(l => l.includes("Mã phiếu nhập chi tiết") && l.includes("Khấu hao"));
  if (lineHeaderIdx === -1) throw new Error("Could not find the line-detail table in sheet2.txt");
  const lines: SheetLine[] = [];
  for (let i = lineHeaderIdx + 1; i < text.length; i++) {
    const line = text[i];
    if (!line.trim().startsWith("| NH")) {
      if (line.trim() === "" || line.trim().startsWith("|  |")) break;
      continue;
    }
    const c = splitRow(line);
    const rawName = unescapeMd(c[1]);
    let itemName = rawName;
    const closeBracket = itemName.indexOf("]");
    if (itemName.startsWith("[") && closeBracket !== -1) itemName = itemName.slice(closeBracket + 1).trim();
    const lastParen = itemName.lastIndexOf("(");
    if (lastParen !== -1 && itemName.endsWith(")")) itemName = itemName.slice(0, lastParen).trim();
    lines.push({
      orderCode: c[0],
      itemName,
      sheetQty: parseVNNumber(c[2]),
      sheetUnit: unescapeMd(c[12]),
      sheetUnitPrice: parseVNNumber(c[13]),
      category: unescapeMd(c[11]),
    });
  }

  return { orders, lines };
}

// ---------------------------------------------------------------------------
// Date handling -- OPEN-ITEMS 55's exact hazard (a bare "YYYY-MM-DDTHH:mm:ss"
// parses as LOCAL time in whatever zone the running process is in). The
// sheet gives a date only; encoded here with an explicit +07:00 offset so
// the result is identical regardless of what machine runs this script,
// matching the convention already on the 11 previously-imported orders
// (e.g. PO-098: sheet "04/04/2026" -> stored "2026-04-03T17:00:00+00:00",
// i.e. Saigon midnight).
function saigonMidnightIso(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(`${y}-${m}-${d}T00:00:00+07:00`).toISOString();
}

function saigonMidnightIsoMs(ddmmyyyy: string): number {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(`${y}-${m}-${d}T00:00:00+07:00`).getTime();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { findAll, insert, update, generateNewId } = await import("@/lib/sheets_db");
  const { savePurchaseOrderAtomic } = await import("@/lib/purchase-order-transaction");

  console.log(`=== import-53-purchase-orders.ts (${apply ? "APPLY" : "DRY RUN"}) ===\n`);

  // --- 1. Load fresh production state ---------------------------------
  const [
    prodOrders, prodLines, prodStockLedger, prodInventoryBalances, prodSuppliers,
    purchasedItems, itemCategories, conversions, units, sources, bands, assets,
  ] = await Promise.all([
    findAll("Purchase_Orders"), findAll("Purchase_Order_Lines"), findAll("Stock_Ledger"),
    findAll("Inventory_Balances"), findAll("Suppliers"), findAll("Purchased_Items"),
    findAll("Item_Categories"), findAll("UOM_Conversions"), findAll("Units"),
    findAll("Purchase_Sources"), findAll("asset_depreciation_bands"), findAll("assets"),
  ]) as any[][];

  console.log("--- Current production state ---");
  console.log(`Purchase_Orders: ${prodOrders.length}`);
  console.log(`Purchase_Order_Lines: ${prodLines.length}`);
  console.log(`Stock_Ledger: ${prodStockLedger.length}`);
  console.log(`Inventory_Balances: ${prodInventoryBalances.length}`);
  console.log(`Suppliers: ${prodSuppliers.length}`);
  console.log(`assets: ${assets.length}`);
  const prodTotalSum = prodOrders.reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0);
  console.log(`Sum(total_amount): ${prodTotalSum.toLocaleString("vi-VN")}d\n`);

  // --- 2. Load the four inputs ------------------------------------------
  const ownerMap: Record<string, string> = JSON.parse(fs.readFileSync(path.join(SCRATCHPAD, "owner-map.json"), "utf8"));
  const unitRules: Record<string, { use: string; factor: number; retitle?: string }> = JSON.parse(
    fs.readFileSync(path.join(SCRATCHPAD, "unit-rules.json"), "utf8"),
  );
  delete (unitRules as any)._note;
  const todoCodes: string[] = JSON.parse(fs.readFileSync(path.join(SCRATCHPAD, "todo-codes.json"), "utf8"));
  const todoSet = new Set(todoCodes);
  console.log(`owner-map.json: ${Object.keys(ownerMap).length} entries`);
  console.log(`unit-rules.json: ${Object.keys(unitRules).length} entries`);
  console.log(`todo-codes.json: ${todoCodes.length} codes\n`);

  const { orders: allSheetOrders, lines: allSheetLines } = parseSheet();
  const todoOrders = allSheetOrders.filter(o => todoSet.has(o.code));
  const todoLines = allSheetLines.filter(l => todoSet.has(l.orderCode));
  console.log(`Parsed sheet: ${allSheetOrders.length} order-header rows, ${allSheetLines.length} line-detail rows`);
  console.log(`Todo orders found in sheet: ${todoOrders.length} of ${todoCodes.length} expected`);
  console.log(`Todo lines found in sheet: ${todoLines.length}\n`);
  if (todoOrders.length !== todoCodes.length) {
    throw new Error("A todo code is missing from the freshly re-parsed sheet -- STOP, do not proceed.");
  }
  const nonSuccess = todoOrders.filter(o => o.status !== "Thành công");
  if (nonSuccess.length > 0) {
    throw new Error(`${nonSuccess.length} todo order(s) are not 'Thành công': ${nonSuccess.map(o => o.code).join(", ")}`);
  }

  // --- 3. Re-verify none of the 53 already exist in production ----------
  const prodSuppliersByName = new Map(prodSuppliers.map((s: any) => [s.name, s]));
  const prodCodesSet = new Set(prodOrders.map((o: any) => o.supplier_invoice_code).filter(Boolean));
  // transaction_date is stored as Saigon midnight -- the PREVIOUS UTC
  // calendar day (e.g. sheet 04/04/2026 -> "2026-04-03T17:00:00+00:00").
  // Comparing via .slice(0, 10) against the sheet's own DD/MM/YYYY is off
  // by one day and silently fails to find a real match -- found 2026-08-27
  // running this exact check a second time: it caught all 14 coded
  // duplicates (a genuine string match) but would have missed all 39
  // uncoded ones and let this script attempt to re-insert them. Compared
  // by instant instead, matching saigonMidnightIso's own construction.
  const prodTripleSet = new Set(
    prodOrders.map((o: any) => {
      const supplier = prodSuppliers.find((s: any) => s.id === o.supplier_id);
      const ms = o.transaction_date ? new Date(o.transaction_date).getTime() : NaN;
      return `${ms}|${supplier?.name}|${o.total_amount}`;
    }),
  );
  let alreadyPresent: string[] = [];
  for (const o of todoOrders) {
    if (o.maPhieu && prodCodesSet.has(o.maPhieu)) alreadyPresent.push(`${o.code} (code ${o.maPhieu})`);
    if (!o.maPhieu) {
      const key = `${saigonMidnightIsoMs(o.dateDDMMYYYY)}|${o.supplier}|${o.total}`;
      if (prodTripleSet.has(key)) alreadyPresent.push(`${o.code} (date/supplier/total match)`);
    }
  }
  if (alreadyPresent.length > 0) {
    throw new Error(`${alreadyPresent.length} todo order(s) already appear present in production -- STOP: ${alreadyPresent.join(", ")}`);
  }
  console.log("Re-verified: none of the 53 todo orders already exist in production (by code or by date+supplier+total).\n");

  // --- 4. Internal consistency of the 53 orders --------------------------
  let consistent = 0;
  for (const o of todoOrders) {
    const computed = o.subtotal + o.shipping + o.shippingDiscount + o.voucher + o.discount + o.tax;
    if (Math.abs(computed - o.total) < 1) consistent++;
  }
  if (consistent !== todoOrders.length) {
    throw new Error(`Only ${consistent}/${todoOrders.length} todo orders are internally consistent -- STOP.`);
  }
  const goodsSum = todoOrders.reduce((s, o) => s + o.subtotal, 0);
  const shippingNetSum = todoOrders.reduce((s, o) => s + o.shipping + o.shippingDiscount, 0);
  const voucherSum = todoOrders.reduce((s, o) => s + o.voucher, 0);
  const discountSum = todoOrders.reduce((s, o) => s + o.discount, 0);
  const taxSum = todoOrders.reduce((s, o) => s + o.tax, 0);
  const totalToAdd = todoOrders.reduce((s, o) => s + o.total, 0);
  console.log("--- Target figure (53 orders, re-derived fresh) ---");
  console.log(`Orders: ${todoOrders.length}  Lines: ${todoLines.length}`);
  console.log(`Goods: ${goodsSum.toLocaleString("vi-VN")}d`);
  console.log(`Shipping net: ${shippingNetSum.toLocaleString("vi-VN")}d`);
  console.log(`Voucher: ${voucherSum.toLocaleString("vi-VN")}d`);
  console.log(`Discount: ${discountSum.toLocaleString("vi-VN")}d`);
  console.log(`Tax: ${taxSum.toLocaleString("vi-VN")}d`);
  console.log(`Total to add: ${totalToAdd.toLocaleString("vi-VN")}d`);
  console.log(`After import: ${prodOrders.length + todoOrders.length} orders, ${prodLines.length + todoLines.length} lines, sum ${(prodTotalSum + totalToAdd).toLocaleString("vi-VN")}d\n`);

  // --- 5. Resolve item names ----------------------------------------------
  const purchasedItemByName = new Map(purchasedItems.map((p: any) => [p.name, p]));
  const purchasedItemById = new Map(purchasedItems.map((p: any) => [p.id, p]));
  const categoryById = new Map(itemCategories.map((c: any) => [c.id, c]));
  function resolveItem(itemName: string): any {
    return purchasedItemByName.get(itemName) || purchasedItemByName.get(ownerMap[itemName]);
  }
  const unresolvedNames = new Set<string>();
  for (const l of todoLines) {
    if (!resolveItem(l.itemName)) unresolvedNames.add(l.itemName);
  }
  if (unresolvedNames.size > 0) {
    throw new Error(`${unresolvedNames.size} item name(s) unresolved: ${[...unresolvedNames].join(" | ")}`);
  }
  console.log(`Item resolution: 107/107 lines resolved (exact match or owner-map).\n`);

  // --- 6. PREP: suppliers (duplicate-name guard) --------------------------
  const distinctSupplierNames = [...new Set(todoOrders.map(o => o.supplier))];
  const suppliersToCreate: string[] = [];
  const supplierWarnings: Array<{ name: string; conflict: any; kind: "exact" | "near" }> = [];
  for (const name of distinctSupplierNames) {
    if (prodSuppliersByName.has(name)) continue; // already exists, link directly
    const exact = findDuplicateActiveName(prodSuppliers as any[], name);
    if (exact) { supplierWarnings.push({ name, conflict: exact, kind: "exact" }); continue; }
    const near = findDiacriticStrippedMatch(prodSuppliers as any[], name);
    if (near) { supplierWarnings.push({ name, conflict: near.conflict, kind: "near" }); continue; }
    suppliersToCreate.push(name);
  }
  console.log("--- PREP: suppliers ---");
  console.log(`Already exist (link directly): ${distinctSupplierNames.length - suppliersToCreate.length - supplierWarnings.length}`);
  console.log(`To create (clean, no warning): ${suppliersToCreate.length}`);
  for (const n of suppliersToCreate) console.log(`  + ${n}`);
  if (supplierWarnings.length > 0) {
    console.log(`BLOCKED -- duplicate-name guard fired on ${supplierWarnings.length} name(s):`);
    for (const w of supplierWarnings) {
      console.log(`  ${w.kind === "exact" ? "EXACT" : "NEAR-MATCH"}: "${w.name}" vs existing "${w.conflict.name}" (${w.conflict.id})`);
    }
    throw new Error("Supplier duplicate-name guard fired -- STOP, needs a human decision (not auto-confirmed).");
  }
  console.log();

  // --- 7. PREP: retitle 2 conversions -------------------------------------
  console.log("--- PREP: retitle conversions ---");
  const retitles: Array<{ conversionId: string; itemId: string; itemName: string; fromUnit: string; toUnit: string }> = [];
  const unitNameById = new Map(units.map((u: any) => [u.id, u.name]));
  for (const [itemId, rule] of Object.entries(unitRules)) {
    if (!rule.retitle) continue;
    const linesForItem = prodLines.filter((l: any) => l.purchased_item_id === itemId);
    if (linesForItem.length > 0) {
      throw new Error(`${itemId} has ${linesForItem.length} purchase line(s) -- retitle would move history, STOP.`);
    }
    const itemConversions = conversions.filter((c: any) => c.purchased_item_id === itemId);
    if (itemConversions.length !== 1) {
      throw new Error(`${itemId} has ${itemConversions.length} conversions, expected exactly 1 -- STOP.`);
    }
    const conv = itemConversions[0] as any;
    retitles.push({
      conversionId: conv.id, itemId, itemName: purchasedItemById.get(itemId)?.name,
      fromUnit: unitNameById.get(conv.purchased_unit) || conv.purchased_unit, toUnit: rule.retitle,
    });
  }
  for (const r of retitles) {
    console.log(`  ${r.conversionId} (${r.itemName}, ${r.itemId}): "${r.fromUnit}" -> "${r.toUnit}" -- 0 purchase lines, safe`);
  }
  console.log();

  // --- 8. Resolve source_id ------------------------------------------------
  const sourceByName = new Map(sources.map((s: any) => [s.name, s]));
  const distinctSourceNames = [...new Set(todoOrders.map(o => o.source))];
  for (const n of distinctSourceNames) {
    if (!sourceByName.has(n)) throw new Error(`Unknown Nguồn "${n}" -- no matching Purchase_Sources row.`);
  }

  // --- 8b. Resolve each line's conversion_id explicitly ---------------------
  // resolveConversion's own no-conversion_id fallback (lib/purchase-ledger-
  // rebuild.ts) compares the line's `unit` against the conversion's RAW
  // `purchased_unit` COLUMN VALUE -- a unit id (e.g. "UNT-003"), not a
  // joined display name. A plain-text unit like "Cái" can never match that,
  // so relying on the fallback throws "Thiếu quy đổi" on every line
  // (confirmed: this is exactly what happened on the first dry run).
  // conversion_id must be supplied explicitly for every line -- resolved
  // here via a real units join, matching the correction the owner's own
  // strict re-check needed.
  const unitIdByNameLower = new Map(units.map((u: any) => [u.name.trim().toLowerCase(), u.id]));
  // Effective post-retitle purchased_unit, so resolution matches what will
  // actually be true once PREP's retitle step lands (dry-run simulates
  // this; --apply runs retitle first, for real, before any order).
  const effectivePurchasedUnitId = new Map<string, string>();
  for (const c of conversions as any[]) {
    const retitle = retitles.find(r => r.conversionId === c.id);
    effectivePurchasedUnitId.set(c.id, retitle ? unitIdByNameLower.get(retitle.toUnit.toLowerCase())! : c.purchased_unit);
  }
  function resolveLineConversionId(itemId: string, targetUnitName: string): string {
    const targetUnitId = unitIdByNameLower.get(targetUnitName.trim().toLowerCase());
    if (!targetUnitId) throw new Error(`No Units row named "${targetUnitName}" (item ${itemId})`);
    const candidates = (conversions as any[]).filter(
      c => c.purchased_item_id === itemId && effectivePurchasedUnitId.get(c.id) === targetUnitId,
    );
    if (candidates.length === 0) {
      const existing = (conversions as any[])
        .filter(c => c.purchased_item_id === itemId)
        .map(c => `${c.id}:${unitNameById.get(effectivePurchasedUnitId.get(c.id))}`);
      throw new Error(`${itemId}: no conversion for unit "${targetUnitName}" (existing: ${existing.join(", ") || "none"})`);
    }
    if (candidates.length > 1) throw new Error(`${itemId}: ambiguous conversion for unit "${targetUnitName}": ${candidates.map(c => c.id).join(",")}`);
    return candidates[0].id;
  }

  // --- 9. Build per-order write plans using REAL production functions ----
  // Suppliers not yet created get a placeholder id in dry-run (the real id
  // only exists once generateNewId actually runs under --apply); this is
  // purely for computing/display, never written.
  const supplierIdByName = new Map<string, string>();
  for (const [name, s] of prodSuppliersByName) supplierIdByName.set(name, (s as any).id);
  for (const name of suppliersToCreate) supplierIdByName.set(name, `NCC-PENDING-${name.slice(0, 12)}`);

  type LineBuild = { purchased_item_id: string; unit: string; quantity: number; subtotal: number; conversion_id: string };
  const linesByOrder = new Map<string, SheetLine[]>();
  for (const l of todoLines) {
    if (!linesByOrder.has(l.orderCode)) linesByOrder.set(l.orderCode, []);
    linesByOrder.get(l.orderCode)!.push(l);
  }

  const orderReports: any[] = [];
  let totalAssetLines = 0;
  let totalBandFailures = 0;
  const bandFailureDetail: any[] = [];

  for (const o of todoOrders) {
    const sheetLines = linesByOrder.get(o.code) || [];
    const writeLines: LineBuild[] = sheetLines.map(l => {
      const item = resolveItem(l.itemName);
      const rule = unitRules[item.id];
      const factor = rule?.factor ?? 1;
      const unit = rule?.use ?? l.sheetUnit;
      return {
        purchased_item_id: item.id,
        unit,
        quantity: l.sheetQty * factor,
        subtotal: Math.round(l.sheetQty * l.sheetUnitPrice),
        conversion_id: resolveLineConversionId(item.id, unit),
      };
    });

    const supplier_id = supplierIdByName.get(o.supplier)!;
    const source_id = (sourceByName.get(o.source) as any).id;
    const effectiveDate = saigonMidnightIso(o.dateDDMMYYYY);

    let writePlan;
    try {
      writePlan = buildPurchaseOrderWritePlan({
        order: {
          id: "", supplier_id, source_id, transaction_date: effectiveDate,
          supplier_invoice_code: o.maPhieu, notes: "",
          subtotal_amount: o.subtotal, shipping_fee: o.shipping + o.shippingDiscount,
          tax_amount: o.tax, voucher_amount: -o.voucher, discount_amount: -o.discount,
          total_amount: o.total, status: "COMPLETED",
          created_by_id: "IMPORT-SCRIPT", created_by_name: "Nhập từ sheet 53 đơn (2026-08-27)",
        },
        lines: writeLines,
        purchasedItems: purchasedItems as any[],
        conversions: conversions as any[],
        createdAt: effectiveDate,
      });
    } catch (e: any) {
      console.error(`\nFAILED building write plan for ${o.code}:`, e.message);
      console.error("Lines submitted:", JSON.stringify(writeLines.map((wl, i) => ({
        item: purchasedItemById.get(wl.purchased_item_id)?.name, unit: JSON.stringify(wl.unit),
        unitCodePoints: [...wl.unit].map(ch => ch.codePointAt(0)!.toString(16)),
        sheetUnit: JSON.stringify(sheetLines[i].sheetUnit),
      })), null, 2));
      throw e;
    }

    // Header consistency guard PO-037 relies on -- re-check here too.
    const lineSubtotalSum = writeLines.reduce((s, l) => s + l.subtotal, 0);
    if (Math.abs(lineSubtotalSum - o.subtotal) >= 1) {
      throw new Error(`${o.code}: line subtotal sum ${lineSubtotalSum} != header subtotal ${o.subtotal}`);
    }

    // Asset-creation preview (Batch 3's hook, replicated) -- for every
    // EQUIPMENT line on this order.
    const equipmentLines: EquipmentPurchaseLine[] = writePlan.lines
      .filter((line: any) => categoryById.get(purchasedItemById.get(line.purchased_item_id)?.item_category_id)?.system_type === "EQUIPMENT")
      .map((line: any) => ({
        lineId: line.id, purchasedItemId: line.purchased_item_id,
        itemName: purchasedItemById.get(line.purchased_item_id)?.name || line.purchased_item_id,
        subtotal: Number(line.subtotal), baseQuantity: Number(line.base_quantity),
      }));

    let assetPlans: any[] = [];
    let assetError: string | null = null;
    if (equipmentLines.length > 0) {
      try {
        assetPlans = planAssetsFromCompletedOrder({
          allLines: writePlan.lines.map((line: any) => ({ lineId: line.id, subtotal: Number(line.subtotal) })),
          equipmentLines,
          additions: o.shipping + o.shippingDiscount + o.tax,
          // o.voucher/o.discount are the sheet's own already-negative
          // values (e.g. -50000) -- allocatePurchaseOrderCost expects a
          // POSITIVE amount to subtract, matching production's own
          // voucher_amount/discount_amount convention. Negated here.
          subtractions: -o.voucher - o.discount,
          bands: bands as unknown as Band[],
        });
        totalAssetLines += assetPlans.length;
      } catch (e: any) {
        assetError = e.message;
        totalBandFailures++;
        bandFailureDetail.push({ order: o.code, error: e.message });
      }
    }

    orderReports.push({
      code: o.code, supplier: o.supplier, date: o.dateDDMMYYYY, source: o.source,
      invoiceCode: o.maPhieu || "(none -- keyed by date+supplier+total)",
      subtotal: o.subtotal, shippingNet: o.shipping + o.shippingDiscount, voucher: o.voucher,
      discount: o.discount, tax: o.tax, total: o.total,
      lines: writeLines.map((wl, i) => ({
        item: purchasedItemById.get(wl.purchased_item_id)?.name, unit: wl.unit,
        sheetQty: sheetLines[i].sheetQty, sheetUnit: sheetLines[i].sheetUnit,
        quantitySubmitted: wl.quantity, subtotal: wl.subtotal,
        baseQuantity: writePlan.lines[i].base_quantity, unitCostLedger: writePlan.ledgerRows[i]?.unit_cost,
      })),
      ledgerRowCount: writePlan.ledgerRows.length,
      equipmentLineCount: equipmentLines.length,
      assetPlans: assetPlans.map(p => ({ item: p.name_snapshot, quantity: p.quantity, unitCost: p.unit_cost, totalCost: p.total_cost, termMonths: p.term_months })),
      assetError,
    });
  }

  // --- 10. Full line-by-line detail ---------------------------------------
  console.log("--- Full line-by-line detail (53 orders, 107 lines) ---\n");
  for (const r of orderReports) {
    console.log(`${r.code} | ${r.date} | ${r.source} | ${r.supplier} | invoice: ${r.invoiceCode}`);
    console.log(`  subtotal ${r.subtotal.toLocaleString("vi-VN")}d + shipping ${r.shippingNet.toLocaleString("vi-VN")}d + voucher ${r.voucher.toLocaleString("vi-VN")}d + discount ${r.discount.toLocaleString("vi-VN")}d + tax ${r.tax.toLocaleString("vi-VN")}d = ${r.total.toLocaleString("vi-VN")}d`);
    for (const l of r.lines) {
      console.log(`    - ${l.item} | sheet: ${l.sheetQty} ${l.sheetUnit} @ ${(l.subtotal / l.sheetQty).toLocaleString("vi-VN")}d/${l.sheetUnit} | submit: unit="${l.unit}" qty=${l.quantitySubmitted} subtotal=${l.subtotal.toLocaleString("vi-VN")}d | base_quantity=${l.baseQuantity} unit_cost(ledger)=${Math.round(l.unitCostLedger).toLocaleString("vi-VN")}d`);
    }
    if (r.assetPlans.length > 0) {
      console.log(`  -> creates ${r.assetPlans.length} asset row(s):`);
      for (const a of r.assetPlans) console.log(`     asset: ${a.item} qty=${a.quantity} unit_cost=${a.unitCost.toLocaleString("vi-VN")}d total_cost=${a.totalCost.toLocaleString("vi-VN")}d term=${a.termMonths}mo`);
    }
    if (r.assetError) console.log(`  !! ASSET CREATION WOULD FAIL: ${r.assetError}`);
    console.log();
  }

  // --- 11. Summary ----------------------------------------------------------
  console.log("--- Summary ---");
  console.log(`Orders: ${orderReports.length}`);
  console.log(`Lines: ${orderReports.reduce((s, r) => s + r.lines.length, 0)}`);
  console.log(`stock_ledger rows to be created: ${orderReports.reduce((s, r) => s + r.ledgerRowCount, 0)} (production ${prodStockLedger.length} -> ${prodStockLedger.length + orderReports.reduce((s, r) => s + r.ledgerRowCount, 0)})`);
  console.log(`Equipment lines: ${orderReports.reduce((s, r) => s + r.equipmentLineCount, 0)}`);
  console.log(`assets rows to be created: ${totalAssetLines} (production ${assets.length} -> ${assets.length + totalAssetLines})`);
  console.log(`Band lookup failures: ${totalBandFailures}`);
  if (bandFailureDetail.length > 0) console.log(JSON.stringify(bandFailureDetail, null, 2));
  console.log(`Suppliers to create: ${suppliersToCreate.length} (production ${prodSuppliers.length} -> ${prodSuppliers.length + suppliersToCreate.length})`);
  console.log(`Conversions to retitle: ${retitles.length}`);
  console.log(`Total to add: ${totalToAdd.toLocaleString("vi-VN")}d`);
  console.log(`After import: ${prodOrders.length + todoOrders.length} orders, sum ${(prodTotalSum + totalToAdd).toLocaleString("vi-VN")}d`);
  console.log(`  = ${prodTotalSum.toLocaleString("vi-VN")} + ${totalToAdd.toLocaleString("vi-VN")} = ${(prodTotalSum + totalToAdd).toLocaleString("vi-VN")}d`);

  if (!apply) {
    console.log("\n=== DRY RUN ONLY -- nothing written. Pass --apply to write for real. ===");
    return;
  }

  if (totalBandFailures > 0) {
    throw new Error(`${totalBandFailures} order(s) would fail asset band lookup -- refusing to --apply until resolved.`);
  }

  // --- 12. APPLY ------------------------------------------------------------
  console.log("\n=== APPLYING ===");

  const createdSupplierIds = new Map<string, string>();
  for (const name of suppliersToCreate) {
    const id = await generateNewId("Suppliers", "NCC");
    await insert("Suppliers", {
      id, name, phone: "", tax_id: "", address: "", links: "", parent_id: "",
      status: "ACTIVE", created_at: new Date().toISOString(),
      duplicate_warning_confirmed: false, duplicate_warning_confirmed_by: null, duplicate_warning_confirmed_at: null,
    });
    createdSupplierIds.set(name, id);
    console.log(`Created supplier ${id}: ${name}`);
  }
  for (const name of suppliersToCreate) supplierIdByName.set(name, createdSupplierIds.get(name)!);

  for (const r of retitles) {
    await update("UOM_Conversions", r.conversionId, { purchased_unit: units.find((u: any) => u.name === r.toUnit)?.id });
    console.log(`Retitled ${r.conversionId}: "${r.fromUnit}" -> "${r.toUnit}"`);
  }

  let ordersCreated = 0, assetsCreated = 0;
  for (const o of todoOrders) {
    const sheetLines = linesByOrder.get(o.code) || [];
    const writeLines: LineBuild[] = sheetLines.map(l => {
      const item = resolveItem(l.itemName);
      const rule = unitRules[item.id];
      const factor = rule?.factor ?? 1;
      const unit = rule?.use ?? l.sheetUnit;
      return {
        purchased_item_id: item.id, unit, quantity: l.sheetQty * factor,
        subtotal: Math.round(l.sheetQty * l.sheetUnitPrice),
        conversion_id: resolveLineConversionId(item.id, unit),
      };
    });
    const supplier_id = supplierIdByName.get(o.supplier)!;
    const source_id = (sourceByName.get(o.source) as any).id;
    const effectiveDate = saigonMidnightIso(o.dateDDMMYYYY);
    const createdAt = new Date().toISOString();

    const writePlan = buildPurchaseOrderWritePlan({
      order: {
        id: "", supplier_id, source_id, transaction_date: effectiveDate,
        supplier_invoice_code: o.maPhieu, notes: "",
        subtotal_amount: o.subtotal, shipping_fee: o.shipping + o.shippingDiscount,
        tax_amount: o.tax, voucher_amount: -o.voucher, discount_amount: -o.discount,
        total_amount: o.total, status: "COMPLETED",
        created_by_id: "IMPORT-SCRIPT", created_by_name: "Nhập từ sheet 53 đơn (2026-08-27)",
      },
      lines: writeLines,
      purchasedItems: purchasedItems as any[],
      conversions: conversions as any[],
      createdAt: effectiveDate,
    });

    const saved = await savePurchaseOrderAtomic({
      order: writePlan.order, lines: writePlan.lines, ledgerRows: writePlan.ledgerRows, replaceExisting: false,
    });
    ordersCreated++;

    const equipmentLines: EquipmentPurchaseLine[] = writePlan.lines
      .filter((line: any) => categoryById.get(purchasedItemById.get(line.purchased_item_id)?.item_category_id)?.system_type === "EQUIPMENT")
      .map((line: any) => ({
        lineId: line.id, purchasedItemId: line.purchased_item_id,
        itemName: purchasedItemById.get(line.purchased_item_id)?.name || line.purchased_item_id,
        subtotal: Number(line.subtotal), baseQuantity: Number(line.base_quantity),
      }));
    if (equipmentLines.length > 0) {
      const assetPlans = planAssetsFromCompletedOrder({
        allLines: writePlan.lines.map((line: any) => ({ lineId: line.id, subtotal: Number(line.subtotal) })),
        equipmentLines, additions: o.shipping + o.shippingDiscount + o.tax, subtractions: -o.voucher - o.discount,
        bands: bands as unknown as Band[],
      });
      for (const plan of assetPlans) {
        const assetId = await generateNewId("assets", "TS");
        await insert("assets", {
          id: assetId, purchased_item_id: plan.purchased_item_id, purchase_order_line_id: plan.purchase_order_line_id,
          name_snapshot: plan.name_snapshot, acquired_date: effectiveDate.slice(0, 10),
          unit_cost: plan.unit_cost, total_cost: plan.total_cost, quantity: plan.quantity, term_months: plan.term_months,
        });
        assetsCreated++;
      }
    }
    console.log(`${o.code} -> ${saved.purchaseOrderId} (${saved.lineCount} lines, ${saved.ledgerCount} ledger rows)`);
  }

  console.log(`\nDone. Orders created: ${ordersCreated}. Assets created: ${assetsCreated}. Suppliers created: ${createdSupplierIds.size}. Conversions retitled: ${retitles.length}.`);
}

main().catch(e => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
