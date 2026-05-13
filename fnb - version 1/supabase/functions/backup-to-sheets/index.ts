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

serve(async (req) => {
  try {
    const env = process.env as unknown as Env;

    if (!env.GOOGLE_SHEETS_CREDENTIALS || !env.SHEET_ID) {
      return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 500 });
    }

    // Verify cron trigger (optional, for security)
    // In production, you might want to validate this

    const startTime = Date.now();

    // TODO: Implement backup logic in subsequent tasks

    const duration = Date.now() - startTime;
    return new Response(JSON.stringify({
      success: true,
      message: 'Backup completed',
      duration: `${duration}ms`
    }), { status: 200 });

  } catch (error) {
    console.error('Backup error:', error);
    return new Response(JSON.stringify({
      error: 'Backup failed',
      message: error instanceof Error ? error.message : String(error)
    }), { status: 500 });
  }
});
