const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rhbewMyE6ws9G3_DSmEbfg_w0omMwFI';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

async function getSheetsClient() {
  const credentialsJson = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function findAll(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = rows[i][index];
    });
    data.push(rowData);
  }
  return data;
}

function generateNewId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

async function appendRows(sheets, sheetName, dataObjects, existingHeaders) {
  if (dataObjects.length === 0) return;
  const values = dataObjects.map(obj => {
    return existingHeaders.map(header => {
      const val = obj[header];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return val.toString();
    });
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values }
  });
}

async function main() {
  console.log("Khởi tạo kết nối...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
  const sheets = await getSheetsClient();

  console.log("Tải dữ liệu từ Google Sheets...");
    const [
      dbOrders, dbProducts, dbVariants, dbRecipes, dbBaseIngs, dbModifiers,
      dbOrderLinesHeaders, dbStockLedgerHeaders, dbOrdersHeaders
    ] = await Promise.all([
    findAll(sheets, 'Orders'),
    findAll(sheets, 'Products'),
    findAll(sheets, 'Product_Variants'),
    findAll(sheets, 'Recipes'),
    findAll(sheets, 'Base_Ingredients'),
    findAll(sheets, 'Modifiers'),
    getHeaders(sheets, 'Order_Lines'),
    getHeaders(sheets, 'Stock_Ledger'),
    getHeaders(sheets, 'Orders')
  ]);

  const syncedOrderIds = new Set(dbOrders.map(o => o.id));

  console.log("Tải đơn hàng từ Supabase...");
  let { data: supabaseOrders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Lỗi lấy đơn hàng từ Supabase:", error);
    return;
  }

  const unsyncedOrders = supabaseOrders.filter(o => !syncedOrderIds.has(o.id) && !o.voided);
  console.log(`Tìm thấy ${unsyncedOrders.length} đơn hàng mới chưa đồng bộ (bỏ qua đơn bị huỷ).`);

  const needsDiscussion = [];
  const mappingErrors = [];
  const toSync = [];

  for (const order of unsyncedOrders) {
    let hasTopping = false;
    let mappedItems = [];

    for (const item of order.items) {
      // Handle accidental topping entered as main item
      if (item.name.toLowerCase().trim() === 'thêm cà phê') {
        const mod = dbModifiers.find(m => m.name === '20ml cốt cà phê');
        if (mod && mappedItems.length > 0) {
          mappedItems[mappedItems.length - 1].modifiers.push({
            id: mod.id,
            name: mod.name,
            price: Number(mod.price || 0),
            group_name: mod.group_name || ''
          });
        } else {
          mappingErrors.push({ order: order.order_num, item: item.name, reason: "Không tìm thấy Modifier hoặc không có món chính trước đó" });
        }
        continue; // Skip processing as a product
      }

      const aliasMap = {
        'cà phê sữa': 'cà phê sữa đá',
        'cà phê đen': 'cà phê đá'
      };
      let itemName = item.name.toLowerCase().trim();
      if (aliasMap[itemName]) itemName = aliasMap[itemName];

      // Map Product
      const product = dbProducts.find(p => p.name.toLowerCase().trim() === itemName);
      if (!product) {
        mappingErrors.push({ order: order.order_num, item: item.name, reason: "Không tìm thấy Product với tên này" });
        continue;
      }

      // Map Variant (size 500ml)
      const variant = dbVariants.find(v => v.product_id === product.id && v.size_name.toLowerCase().includes('500ml'));
      if (!variant) {
        mappingErrors.push({ order: order.order_num, item: item.name, reason: "Không tìm thấy Size 500ml cho sản phẩm này" });
        continue;
      }

      // Map Toppings
      let mappedModifiers = [];
      let toppingError = false;
      if (item.toppings && item.toppings.length > 0) {
        const toppingAlias = {
          'thêm cà phê': '20ml cốt cà phê'
        };
        for (const t of item.toppings) {
          let tName = t.toLowerCase().trim();
          if (toppingAlias[tName]) tName = toppingAlias[tName];
          
          const mod = dbModifiers.find(m => m.name.toLowerCase().trim() === tName);
          if (!mod) {
            mappingErrors.push({ order: order.order_num, item: t, reason: "Không tìm thấy Modifier với tên này" });
            toppingError = true;
            break;
          }
          mappedModifiers.push({
            id: mod.id,
            name: mod.name,
            price: Number(mod.price || 0),
            group_name: mod.group_name || ''
          });
        }
      }
      if (toppingError) continue;

      mappedItems.push({
        product_id: product.id,
        variant_id: variant.id,
        qty: item.qty,
        unit_price: item.price,
        modifiers: mappedModifiers
      });
    }

    if (mappedItems.length === order.items.filter(i => i.name.toLowerCase().trim() !== 'thêm cà phê').length) {
      toSync.push({ order, mappedItems });
    }
  }

  console.log(`\nPhân loại:`);
  console.log(`- Có topping (cần thảo luận): ${needsDiscussion.length}`);
  console.log(`- Lỗi mapping: ${mappingErrors.length}`);
  console.log(`- Hợp lệ để đồng bộ: ${toSync.length}`);

  if (mappingErrors.length > 0) {
    console.log("Chi tiết lỗi mapping:", mappingErrors);
  }

  if (needsDiscussion.length > 0) {
    const artifactPath = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\feeb7fbb-47ee-4e23-836a-2f6303815cf9\\orders_with_toppings.md';
    fs.writeFileSync(artifactPath, 
      `# Đơn hàng có Toppings\n\nCác đơn hàng sau có chứa Toppings, cần được quyết định cách nhập liệu:\n\n\`\`\`json\n${JSON.stringify(needsDiscussion, null, 2)}\n\`\`\``
    );
    console.log("\nĐã lưu danh sách đơn có topping vào artifact");
  }

  // Thực hiện đồng bộ các đơn hợp lệ
  if (toSync.length > 0) {
    console.log("\nBắt đầu tạo dữ liệu đồng bộ...");
    const newOrders = [];
    const newOrderLines = [];
    const newStockLedgers = [];

    for (const { order, mappedItems } of toSync) {
      const order_id = order.id; // Giữ nguyên UUID từ Supabase
      
      newOrders.push({
        id: order_id,
        order_no: order.order_num || `OD${Date.now().toString().slice(-6)}`,
        total_amount: order.total,
        status: "COMPLETED",
        created_at: order.created_at
      });

      for (const item of mappedItems) {
        newOrderLines.push({
          id: generateNewId("OL"),
          order_id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: item.qty,
          unit_price: item.unit_price,
          modifiers_json: JSON.stringify(item.modifiers || []),
          created_at: order.created_at
        });

        // Trừ kho theo công thức (Variant)
        const variantRecipe = dbRecipes.find(r => 
          r.target_type === "PRODUCT_VARIANT" && 
          r.target_id === item.variant_id && 
          (!r.end_date || r.end_date === "")
        );

        if (variantRecipe && variantRecipe.ingredients_json) {
          let ings = [];
          try { ings = JSON.parse(variantRecipe.ingredients_json); } catch(e){}
          
          for (const ing of ings) {
            let skip = false;
            if (ing.ingredient_type === "BASE_INGREDIENT") {
              const baseIng = dbBaseIngs.find(b => b.id === ing.ingredient_id);
              if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
            }

            if (!skip && ing.quantity > 0) {
              const consumeQty = Number(ing.quantity) * Number(item.qty);
              newStockLedgers.push({
                id: generateNewId("STK"),
                transaction_type: "SALES_CONSUME",
                reference_id: order_id,
                item_reference: ing.ingredient_id,
                quantity_change: -consumeQty,
                unit_cost: 0,
                created_at: order.created_at
              });
            }
          }
        }

        // Trừ kho theo công thức (Modifiers)
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            const modRecipe = dbRecipes.find(r => 
              r.target_type === "MODIFIER" && 
              r.target_id === mod.id && 
              (!r.end_date || r.end_date === "")
            );

            if (modRecipe && modRecipe.ingredients_json) {
              let modIngs = [];
              try { modIngs = JSON.parse(modRecipe.ingredients_json); } catch(e){}
              
              for (const ing of modIngs) {
                let skip = false;
                if (ing.ingredient_type === "BASE_INGREDIENT") {
                  const baseIng = dbBaseIngs.find(b => b.id === ing.ingredient_id);
                  if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
                }

                if (!skip && ing.quantity > 0) {
                  const consumeQty = Number(ing.quantity) * Number(item.qty);
                  newStockLedgers.push({
                    id: generateNewId("STK"),
                    transaction_type: "SALES_CONSUME",
                    reference_id: order_id,
                    item_reference: ing.ingredient_id,
                    quantity_change: -consumeQty,
                    unit_cost: 0,
                    created_at: order.created_at
                  });
                }
              }
            }
          }
        }
      }
    }

    console.log("Đang ghi vào Google Sheets...");
    await appendRows(sheets, 'Orders', newOrders, dbOrdersHeaders);
    await appendRows(sheets, 'Order_Lines', newOrderLines, dbOrderLinesHeaders);
    await appendRows(sheets, 'Stock_Ledger', newStockLedgers, dbStockLedgerHeaders);

    console.log("Đồng bộ thành công!");
  }
}

async function getHeaders(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  return res.data.values[0] || [];
}

main().catch(console.error);
