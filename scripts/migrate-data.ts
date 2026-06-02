import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { findAll, insert, generateNewId } from '../lib/sheets_db';

const NON_INVENTORY_KEYWORDS = ['nước', 'đá viên'];

function cleanNumber(str: string) {
  if (!str) return 0;
  return Number(str.replace(/,/g, ''));
}

async function runMigration() {
  console.log("Bắt đầu Migration...");
  const data = JSON.parse(fs.readFileSync('C:\\Users\\Admin\\Desktop\\fnbapp\\user_data_sample.json', 'utf8'));

  const unitsData = data['ĐƠN VỊ TÍNH']; // [["Mã", "ĐVT"], ["ĐVT0001", "Bình"], ...]
  const nlsData = data['NHÓM NGUYÊN LIỆU']; // [["Mã", "Tên", "Tên hiển thị", "Đơn vị", "Tổng SL nhập", "Tổng giá nhập", ...], ...]

  // 1. Migrate Units
  const existingUnits = await findAll("Units");
  const unitMap: Record<string, string> = {}; // Tên ĐVT -> ID

  for (let i = 1; i < unitsData.length; i++) {
    const row = unitsData[i];
    if (!row || row.length < 2) continue;
    const unitName = row[1].trim();
    
    let u = existingUnits.find((x:any) => x.name.toLowerCase() === unitName.toLowerCase());
    if (!u) {
      const newId = await generateNewId("Units", "UNT");
      await insert("Units", { id: newId, name: unitName, description: "Migrated" });
      unitMap[unitName.toLowerCase()] = newId;
    } else {
      unitMap[unitName.toLowerCase()] = u.id;
    }
  }

  // Reload units
  const finalUnits = await findAll("Units");
  finalUnits.forEach((u:any) => unitMap[u.name.toLowerCase()] = u.id);

  // 2. Migrate Base Ingredients
  const existingCategories = await findAll("Product_Categories");
  let cat = existingCategories.find((c:any) => c.name === "Nguyên Liệu Gốc");
  let catId = cat?.id;
  if (!catId) {
    catId = await generateNewId("Product_Categories", "CAT");
    await insert("Product_Categories", { id: catId, name: "Nguyên Liệu Gốc", status: "ACTIVE" });
  }

  const existingBaseIngs = await findAll("Base_Ingredients");
  const baseIngMap: Record<string, string> = {};

  const initialStockLines = [];

  for (let i = 1; i < nlsData.length; i++) {
    const row = nlsData[i];
    if (!row || row.length < 5) continue;
    
    const oldCode = row[0];
    const name = row[1];
    const unitName = row[3];
    const totalQty = cleanNumber(row[4]);
    const totalCost = cleanNumber(row[5]);

    if (!name || name.trim() === '') continue;

    const isNonInventory = NON_INVENTORY_KEYWORDS.some(kw => name.toLowerCase().includes(kw));

    let bId = existingBaseIngs.find((b:any) => b.name === name)?.id;
    if (!bId) {
      await new Promise(r => setTimeout(r, 1500)); // Tránh lỗi Rate Limit API Google Sheets
      bId = await generateNewId("Base_Ingredients", "ING");
      
      let uId = unitMap[unitName?.toLowerCase()];
      if (!uId) {
        // Create unit if not exist
        uId = await generateNewId("Units", "UNT");
        await insert("Units", { id: uId, name: unitName || "N/A", description: "Auto created" });
        unitMap[unitName?.toLowerCase() || "N/A"] = uId;
      }

      await insert("Base_Ingredients", {
        id: bId,
        name: name,
        category_id: catId,
        base_unit: uId,
        status: "ACTIVE",
        is_non_inventory: isNonInventory ? "TRUE" : "FALSE"
      });
    }

    // Prepare initial stock if qty > 0
    if (totalQty > 0 && !isNonInventory) {
      initialStockLines.push({
        base_ingredient_id: bId,
        qty: totalQty,
        cost: totalCost
      });
    }
  }

  // 3. Create ONE massive Purchase Order for "Tồn kho đầu kỳ"
  if (initialStockLines.length > 0) {
    // Check if supplier exists
    const suppliers = await findAll("Suppliers");
    let suppId = suppliers[0]?.id;
    if (!suppId) {
      suppId = await generateNewId("Suppliers", "SUP");
      await insert("Suppliers", { id: suppId, name: "Nhà cung cấp Đầu kỳ", status: "ACTIVE" });
    }

    const totalAmount = initialStockLines.reduce((sum, l) => sum + l.cost, 0);
    const poId = await generateNewId("Purchase_Orders", "PO");
    
    // Set transaction date to the past
    const migrationDate = new Date("2025-01-01T00:00:00Z").toISOString();

    await insert("Purchase_Orders", {
      id: poId,
      supplier_id: suppId,
      status: "COMPLETED",
      total_amount: totalAmount,
      subtotal_amount: totalAmount,
      shipping_fee: 0,
      tax_amount: 0,
      voucher_amount: 0,
      discount_amount: 0,
      notes: "Nhập Tồn Kho Đầu Kỳ từ File Cũ",
      created_by: "MIGRATION",
      transaction_date: migrationDate,
      created_at: new Date().toISOString()
    });

    for (const line of initialStockLines) {
      await new Promise(r => setTimeout(r, 1500)); // Tránh lỗi Rate Limit
      const ledger_id = await generateNewId("Stock_Ledger", "STK");
      const unitCost = line.qty > 0 ? line.cost / line.qty : 0;
      
      await insert("Stock_Ledger", {
        id: ledger_id,
        transaction_type: "PO_RECEIPT",
        reference_id: poId,
        item_reference: line.base_ingredient_id,
        quantity_change: line.qty,
        unit_cost: unitCost,
        created_at: migrationDate
      });
    }
  }

  console.log("Migration hoàn tất!");
}

runMigration().catch(console.error);
