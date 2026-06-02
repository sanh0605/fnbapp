const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = '1RF-B2DLjLxuJ9VWtqJhiQLb5qlcUFVoehl7RxOP6xNc';
const KEY_FILE_PATH = path.join(__dirname, '..', 'beverages-496303-1b8b558284f8.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const requiredTabs = [
  { name: 'Brands', headers: ['id', 'name', 'start_date', 'created_at'] },
  { name: 'Users', headers: ['id', 'username', 'password_hash', 'role', 'created_at'] },
  { name: 'Permissions', headers: ['id', 'role_or_user', 'module', 'can_view', 'can_edit'] },
  { name: 'User_Brands', headers: ['id', 'user_id', 'brand_id'] },
  { name: 'Suppliers', headers: ['id', 'name', 'phone', 'tax_id', 'address', 'parent_id', 'links'] },
  { name: 'Inventory_Categories', headers: ['id', 'name', 'type', 'base_unit'] },
  { name: 'Purchased_Items', headers: ['id', 'name', 'category_id'] },
  { name: 'UOM_Conversions', headers: ['id', 'purchased_item_id', 'purchased_unit', 'base_unit', 'conversion_rate'] },
  { name: 'Semi_Products', headers: ['id', 'name', 'base_unit', 'allow_separate'] },
  { name: 'Semi_Product_Recipes', headers: ['id', 'semi_product_id', 'start_date', 'end_date', 'ingredients'] },
  { name: 'Finished_Products', headers: ['id', 'name', 'category', 'is_active'] },
  { name: 'Product_Brands', headers: ['id', 'product_id', 'brand_id'] },
  { name: 'Finished_Product_Recipes', headers: ['id', 'product_id', 'size', 'start_date', 'end_date', 'ingredients'] },
  { name: 'Finished_Product_Prices', headers: ['id', 'product_id', 'size', 'price', 'start_date', 'end_date'] },
  { name: 'Inventory_Batches', headers: ['id', 'item_type', 'item_id', 'qty_initial', 'qty_remaining', 'unit_cost', 'status', 'created_at'] },
  { name: 'Inventory_Transactions', headers: ['id', 'batch_id', 'tx_type', 'qty_change', 'reference_id', 'created_at'] },
  { name: 'Purchase_Orders', headers: ['id', 'supplier_id', 'status', 'total_amount', 'paid_amount', 'created_at'] },
  { name: 'PO_Items', headers: ['id', 'po_id', 'purchased_item_id', 'qty_ordered', 'qty_received', 'unit_price'] },
  { name: 'Production_Orders', headers: ['id', 'apply_date', 'created_at'] },
  { name: 'Production_Items', headers: ['id', 'production_order_id', 'semi_product_id', 'qty_produced', 'total_cost'] },
  { name: 'Spoilage_Orders', headers: ['id', 'apply_date', 'created_at', 'total_loss_value'] },
  { name: 'Spoilage_Items', headers: ['id', 'spoilage_order_id', 'item_type', 'item_id', 'qty_spoiled', 'loss_value'] },
  { name: 'POS_Orders', headers: ['id', 'brand_id', 'user_id', 'total_amount', 'discount_amount', 'final_amount', 'payment_method', 'status', 'created_at'] },
  { name: 'POS_Order_Items', headers: ['id', 'order_id', 'product_id', 'size', 'qty', 'base_price', 'line_discount', 'prorated_revenue', 'ice_level', 'sugar_percent', 'toppings_note'] },
  { name: 'Stocktake_Records', headers: ['id', 'created_at', 'status'] },
];

async function run() {
  console.log("Fetching existing spreadsheet metadata...");
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = meta.data.sheets.map(s => s.properties.title.toLowerCase().trim());
  
  // 1. Create missing sheets one by one
  for (const tab of requiredTabs) {
    if (!existingSheets.includes(tab.name.toLowerCase().trim())) {
      console.log(`Creating sheet: ${tab.name}`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: tab.name }
              }
            }]
          }
        });
        console.log(`Created: ${tab.name}`);
      } catch (err) {
        console.error(`Failed to create ${tab.name}:`, err.message);
      }
    } else {
      console.log(`Sheet already exists: ${tab.name}`);
    }
  }

  // 2. Set headers for all sheets
  console.log("Setting headers...");
  for (const tab of requiredTabs) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${tab.name}!A1:Z1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [tab.headers]
        }
      });
      console.log(`Updated headers for ${tab.name}`);
    } catch (err) {
      console.error(`Failed to set headers for ${tab.name}:`, err.message);
    }
  }
  
  console.log("Initialization complete!");
}

run().catch(console.error);
