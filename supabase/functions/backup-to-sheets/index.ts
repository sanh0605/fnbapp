import { createClient } from 'npm:@supabase/supabase-js@2.5.0';

interface Env {
  GOOGLE_SHEETS_CREDENTIALS: string;
  SHEET_ID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

// Google Sheets API URLs
const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

// Get OAuth2 access token from service account credentials
async function getAccessToken(credentialsBase64: string): Promise<string> {
  const credentialsJson = JSON.parse(
    atob(credentialsBase64)
  );

  // Use service account credentials directly for OAuth
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: Deno.env.get('GOOGLE_SHEETS_CREDENTIALS')
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function getSupabaseClient(): ReturnType<typeof createClient> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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

  if (!lastBackup) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', thirtyDaysAgo);
  } else {
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
  const headers = [
    'Order ID', 'Order #', 'Date', 'Time', 'Outlet', 'Brand', 'Staff',
    'Total Items', 'Subtotal', 'Discount Amount', 'Payable', 'Actual Received',
    'Change', 'Payment Method', 'Voided', 'Backup At'
  ];

  const rows = [headers];

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
    category: 'N/A',
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
  const headers = [
    'Order ID', 'Order #', 'Item ID', 'Product Name', 'Category', 'Quantity',
    'Unit Price', 'Item Total', 'Sweetness', 'Ice Level', 'Toppings',
    'Toppings Price', 'Note', 'Backup At'
  ];

  const rows = [headers];

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
  accessToken: string,
  sheetId: string,
  sheetName: string,
  rows: (string | number)[][]
): Promise<void> {
  const spreadsheetId = sheetId;

  const response = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}?key=${accessToken}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get sheet: ${errorText}`);
  }
  const spreadsheet = await response.json();

  const sheetTab = spreadsheet?.sheets?.find(
    (s: any) => s.properties?.title === sheetName
  );

  if (!sheetTab) {
    throw new Error(`Sheet tab "${sheetName}" not found`);
  }

  const sheetIdNum = sheetTab.properties.sheetId;

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await withRetry(async () => {
      const appendResponse = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A${i + 1}`)}:append?valueInputOption=USER_ENTERED&key=${accessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: batch })
      });

      if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        throw new Error(`Failed to append rows: ${errorText}`);
      }
    });
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

      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

// Initialize sheet with headers if needed
async function ensureSheetHeaders(
  accessToken: string,
  sheetId: string,
  sheetName: string,
  headers: string[]
): Promise<void> {
  const response = await fetch(`${SHEETS_BASE_URL}/${sheetId}/values/${encodeURIComponent(`${sheetName}!A1:Z1`)}?key=${accessToken}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to check sheet headers: ${errorText}`);
  }
  const data = await response.json();

  if (data?.values?.length > 0) {
    return;
  }

  await fetch(`${SHEETS_BASE_URL}/${sheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=USER_ENTERED&key=${accessToken}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [headers] })
  });
}

Deno.serve(async (req) => {
  try {
    const credentialsBase64 = Deno.env.get('GOOGLE_SHEETS_CREDENTIALS');
    const sheetId = Deno.env.get('SHEET_ID');

    if (!credentialsBase64 || !sheetId) {
      return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 500 });
    }

    const startTime = Date.now();

    const supabase = getSupabaseClient();
    const accessToken = await getAccessToken(credentialsBase64);

    const { orders, isFirstRun } = await fetchOrders(supabase);

    if (orders.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No new orders to backup'
      }), { status: 200 });
    }

    const summaryRows = transformOrdersToSummaryRows(orders);
    const itemRows = transformOrdersToItemRows(orders);

    if (isFirstRun) {
      const summaryHeaders = summaryRows[0] as string[];
      const itemHeaders = itemRows[0] as string[];
      await ensureSheetHeaders(accessToken, sheetId, 'Orders Summary', summaryHeaders);
      await ensureSheetHeaders(accessToken, sheetId, 'Order Items Detail', itemHeaders);

      summaryRows.shift();
      itemRows.shift();
    }

    await writeToSheet(accessToken, sheetId, 'Orders Summary', summaryRows);
    await writeToSheet(accessToken, sheetId, 'Order Items Detail', itemRows);

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
