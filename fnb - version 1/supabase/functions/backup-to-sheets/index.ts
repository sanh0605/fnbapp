import { serve } from '@supabase/functions-js';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

interface Env {
  GOOGLE_SHEETS_CREDENTIALS: string;
  SHEET_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Decode base64 credentials and return authenticated sheets API
async function getSheetsClient(credentialsBase64: string) {
  const credentialsJson = JSON.parse(
    Buffer.from(credentialsBase64, 'base64').toString('utf-8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials: credentialsJson,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

function getSupabaseClient(): ReturnType<typeof createClient> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseKey);
}

interface Order {
  id: string;
  order_num: string;
  created_at: string;
  total: number;
  subtotal: number | null;
  discount_amount: number | null;
  actual_received: number | null;
  method: string;
  items: OrderItem[];
  staff_name: string | null;
  outlet_id: string | null;
  brand_id: string | null;
  voided: boolean;
}

interface OrderItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  sweet: string | null;
  ice: string | null;
  toppings: Topping[] | null;
  note: string | null;
}

interface Topping {
  id: string;
  name: string;
  price: number;
}

// Fetch orders created after the last backup timestamp
async function fetchOrders(supabase: ReturnType<typeof createClient>) {
  // Get last backup timestamp from settings
  const { data: settings } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'sheets_last_backup')
    .single();

  const lastBackup = settings?.value;
  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  // First run: backup last 30 days
  if (!lastBackup) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', thirtyDaysAgo);
  } else {
    // Subsequent runs: backup since last timestamp
    query = query.gt('created_at', lastBackup);
  }

  const { data: orders, error } = await query;

  if (error) throw error;

  return { orders: (orders || []) as Order[], isFirstRun: !lastBackup };
}

// Transform ISO timestamp to date format YYYY-MM-DD
function formatDate(isoDate: string): string {
  return isoDate.split('T')[0];
}

// Transform ISO timestamp to time format HH:MM:SS
function formatTime(isoDate: string): string {
  return isoDate.split('T')[1]?.split('.')[0] || '00:00:00';
}

// OrderSummaryRow matches the Google Sheet column structure
interface OrderSummaryRow {
  orderId: string;
  orderNum: string;
  date: string;
  time: string;
  outlet: string;
  brand: string;
  staff: string;
  totalItems: number;
  subtotal: number;
  discountAmount: number;
  payable: number;
  actualReceived: number;
  change: number;
  paymentMethod: string;
  voided: string;
  backupAt: string;
}

// Transform order to Orders Summary row
function transformToOrderSummary(order: Order): OrderSummaryRow {
  const totalItems = order.items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = order.subtotal || 0;
  const discount = order.discount_amount || 0;
  const actualReceived = order.actual_received || order.total;
  const payable = order.total;
  const change = Math.max(0, actualReceived - payable);

  // Format outlet and brand names (simplified - in production you'd fetch from tables)
  const outletName = order.outlet_id ? `${order.outlet_id}` : 'N/A';
  const brandName = order.brand_id ? `${order.brand_id}` : 'N/A';

  return {
    orderId: order.id,
    orderNum: order.order_num,
    date: formatDate(order.created_at),
    time: formatTime(order.created_at),
    outlet: outletName,
    brand: brandName,
    staff: order.staff_name || 'N/A',
    totalItems,
    subtotal,
    discountAmount: discount,
    payable,
    actualReceived,
    change,
    paymentMethod: order.method || 'N/A',
    voided: order.voided ? 'TRUE' : 'FALSE',
    backupAt: new Date().toISOString()
  };
}

// Transform array of orders to Orders Summary rows (2D array for Sheets API)
function transformOrdersToSummaryRows(orders: Order[]): (string | number)[][] {
  // Header row
  const headers = [
    'Order ID', 'Order #', 'Date', 'Time', 'Outlet', 'Brand', 'Staff',
    'Total Items', 'Subtotal', 'Discount Amount', 'Payable', 'Actual Received',
    'Change', 'Payment Method', 'Voided', 'Backup At'
  ];

  const rows = [headers];

  // Data rows
  for (const order of orders) {
    const summary = transformToOrderSummary(order);
    rows.push([
      summary.orderId,
      summary.orderNum,
      summary.date,
      summary.time,
      summary.outlet,
      summary.brand,
      summary.staff,
      summary.totalItems,
      summary.subtotal,
      summary.discountAmount,
      summary.payable,
      summary.actualReceived,
      summary.change,
      summary.paymentMethod,
      summary.voided,
      summary.backupAt
    ]);
  }

  return rows;
}

// OrderItemRow matches the Google Sheet column structure
interface OrderItemRow {
  orderId: string;
  orderNum: string;
  itemId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  itemTotal: number;
  sweetness: string;
  iceLevel: string;
  toppings: string;
  toppingsPrice: number;
  note: string;
  backupAt: string;
}

// Transform order item to Order Items Detail row
function transformToOrderItemRow(order: Order, item: OrderItem): OrderItemRow {
  const toppings = item.toppings || [];
  const toppingsPrice = toppings.reduce((sum, t) => sum + t.price, 0);
  const toppingNames = toppings.map(t => t.name).join(', ');

  return {
    orderId: order.id,
    orderNum: order.order_num,
    itemId: item.id,
    productName: item.name,
    category: 'N/A', // In production, fetch from products table
    quantity: item.qty,
    unitPrice: item.price,
    itemTotal: item.qty * item.price,
    sweetness: item.sweet || '100%',
    iceLevel: item.ice || 'Bình thường',
    toppings: toppingNames,
    toppingsPrice,
    note: item.note || '',
    backupAt: new Date().toISOString()
  };
}

// Transform array of orders to Order Items Detail rows (2D array for Sheets API)
function transformOrdersToItemRows(orders: Order[]): (string | number)[][] {
  // Header row
  const headers = [
    'Order ID', 'Order #', 'Item ID', 'Product Name', 'Category', 'Quantity',
    'Unit Price', 'Item Total', 'Sweetness', 'Ice Level', 'Toppings',
    'Toppings Price', 'Note', 'Backup At'
  ];

  const rows = [headers];

  // Data rows - one row per item
  for (const order of orders) {
    for (const item of order.items) {
      const itemRow = transformToOrderItemRow(order, item);
      rows.push([
        itemRow.orderId,
        itemRow.orderNum,
        itemRow.itemId,
        itemRow.productName,
        itemRow.category,
        itemRow.quantity,
        itemRow.unitPrice,
        itemRow.itemTotal,
        itemRow.sweetness,
        itemRow.iceLevel,
        itemRow.toppings,
        itemRow.toppingsPrice,
        itemRow.note,
        itemRow.backupAt
      ]);
    }
  }

  return rows;
}

// Write rows to a specific sheet tab
async function writeToSheet(
  sheets: any,
  sheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  const spreadsheetId = sheetId;

  // Get sheet info to find the sheet tab ID
  const { data: spreadsheet } = await sheets.spreadsheets.get({
    spreadsheetId
  });

  const sheetTab = spreadsheet?.sheets?.find(
    (s: any) => s.properties?.title === sheetName
  );

  if (!sheetTab) {
    throw new Error(`Sheet tab "${sheetName}" not found`);
  }

  const sheetIdNum = sheetTab.properties.sheetId;

  // Append rows in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const request = {
      spreadsheetId,
      range: `${sheetName}!A${i + 1}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: batch
      }
    };

    // Retry with exponential backoff
    await withRetry(() =>
      sheets.spreadsheets.values.update(request)
    );
  }
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Initialize sheet with headers if needed
async function ensureSheetHeaders(
  sheets: any,
  sheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const { data: existingData } = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1:Z1`
  });

  if (existingData?.values?.length > 0) {
    return; // Headers already exist
  }

  // Write headers
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [headers]
    }
  });
}

serve(async (req) => {
  try {
    const env = process.env as unknown as Env;

    if (!env.GOOGLE_SHEETS_CREDENTIALS || !env.SHEET_ID) {
      return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 500 });
    }

    // Verify cron trigger (optional, for security)
    // In production, you might want to validate this

    const startTime = Date.now();

    const supabase = getSupabaseClient();
    const sheets = await getSheetsClient(env.GOOGLE_SHEETS_CREDENTIALS);

    // Fetch orders
    const { orders, isFirstRun } = await fetchOrders(supabase);

    if (orders.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No new orders to backup'
      }), { status: 200 });
    }

    // Transform data
    const summaryRows = transformOrdersToSummaryRows(orders);
    const itemRows = transformOrdersToItemRows(orders);

    // Ensure headers exist (for first run)
    if (isFirstRun) {
      const summaryHeaders = summaryRows[0] as string[];
      const itemHeaders = itemRows[0] as string[];
      await ensureSheetHeaders(sheets, env.SHEET_ID, 'Orders Summary', summaryHeaders);
      await ensureSheetHeaders(sheets, env.SHEET_ID, 'Order Items Detail', itemHeaders);

      // Remove headers from rows for initial write
      summaryRows.shift();
      itemRows.shift();
    }

    // Write to Sheets (append without headers on subsequent runs)
    await writeToSheet(sheets, env.SHEET_ID, 'Orders Summary', summaryRows);
    await writeToSheet(sheets, env.SHEET_ID, 'Order Items Detail', itemRows);

    // Update backup timestamp
    const now = new Date().toISOString();
    await supabase
      .from('settings')
      .upsert({ key: 'sheets_last_backup', value: now });

    const duration = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: true,
      message: `Backed up ${orders.length} orders`,
      ordersBackedUp: orders.length,
      duration: `${duration}ms`,
      backupAt: now
    }), { status: 200 });

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(JSON.stringify({
      error: 'Backup failed',
      message: error instanceof Error ? error.message : String(error)
    }), { status: 500 });
  }
});
