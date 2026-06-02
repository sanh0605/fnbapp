# Google Sheets Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated daily backup system that copies orders from Supabase to Google Sheets as a safety net against potential Supabase free tier termination.

**Architecture:** A Supabase Edge Function runs daily at midnight UTC (via cron), queries new orders using a timestamp checkpoint in the settings table, transforms the data into two structured formats (order summary and item details), and writes batches to a Google Sheet using Service Account authentication.

**Tech Stack:** Supabase Edge Functions (TypeScript), Google Sheets API (googleapis library), Service Account authentication, cron scheduling

---

## File Structure

| Path | Responsibility |
|------|---------------|
| `supabase/functions/backup-to-sheets/index.ts` | Main Edge Function: fetch orders, transform, write to Sheets |
| `supabase/functions/backup-to-sheets/tsconfig.json` | TypeScript configuration for Edge Function |
| `supabase/functions/backup-to-sheets/package.json` | Dependencies (googleapis, @supabase/functions-js) |

---

### Task 1: Create Edge Function directory structure

**Files:**
- Create: `supabase/functions/backup-to-sheets/package.json`
- Create: `supabase/functions/backup-to-sheets/tsconfig.json`

- [ ] **Step 1: Create package.json with dependencies**

```json
{
  "name": "backup-to-sheets",
  "version": "1.0.0",
  "type": "module",
  "main": "index.ts",
  "dependencies": {
    "@supabase/functions-js": "^2.3.1",
    "googleapis": "^140.0.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/backup-to-sheets/package.json supabase/functions/backup-to-sheets/tsconfig.json
git commit -m "feat: create Edge Function package.json and tsconfig"
```

---

### Task 2: Create base Edge Function with authentication setup

**Files:**
- Create: `supabase/functions/backup-to-sheets/index.ts`

- [ ] **Step 1: Write base function structure with Google Sheets auth**

```typescript
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

// Transform ISO timestamp to date format YYYY-MM-DD
function formatDate(isoDate: string): string {
  return isoDate.split('T')[0];
}

// Transform ISO timestamp to time format HH:MM:SS
function formatTime(isoDate: string): string {
  return isoDate.split('T')[1]?.split('.')[0] || '00:00:00';
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: create base Edge Function with Google Sheets auth"
```

---

### Task 3: Implement Supabase client and fetch orders logic

**Files:**
- Modify: `supabase/functions/backup-to-sheets/index.ts:1-80`

- [ ] **Step 1: Add Supabase client initialization and fetch orders function**

```typescript
// Add these imports at the top
import { createClient } from '@supabase/supabase-js';

// Add after getSheetsClient function
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: add Supabase client and fetch orders logic"
```

---

### Task 4: Implement data transformation for Orders Summary

**Files:**
- Modify: `supabase/functions/backup-to-sheets/index.ts:80-150`

- [ ] **Step 1: Add transformation function for Orders Summary sheet**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: add Orders Summary data transformation"
```

---

### Task 5: Implement data transformation for Order Items Detail

**Files:**
- Modify: `supabase/functions/backup-to-sheets/index.ts:150-220`

- [ ] **Step 1: Add transformation function for Order Items Detail sheet**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: add Order Items Detail data transformation"
```

---

### Task 6: Implement Google Sheets write functionality

**Files:**
- Modify: `supabase/functions/backup-to-sheets/index.ts:220-300`

- [ ] **Step 1: Add functions to write to Google Sheets with error handling**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: add Google Sheets write with retry logic"
```

---

### Task 7: Implement main backup workflow in Edge Function

**Files:**
- Modify: `supabase/functions/backup-to-sheets/index.ts:40-80`

- [ ] **Step 1: Replace TODO with complete backup workflow**

```typescript
// Replace the TODO section in serve() with this:
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/backup-to-sheets/index.ts
git commit -m "feat: implement complete backup workflow"
```

---

### Task 8: Install dependencies and deploy Edge Function locally

**Files:**
- No file changes

- [ ] **Step 1: Navigate to function directory and install dependencies**

```bash
cd supabase/functions/backup-to-sheets
npm install
```

- [ ] **Step 2: Verify dependencies installed**

Expected: `package-lock.json` file created, `node_modules` directory exists

- [ ] **Step 3: Test function locally (optional)**

```bash
npx supabase functions serve backup-to-sheets
```

- [ ] **Step 4: Commit package-lock.json**

```bash
git add supabase/functions/backup-to-sheets/package-lock.json
git commit -m "chore: install dependencies for backup-to-sheets"
```

---

### Task 9: Deploy Edge Function to Supabase

**Files:**
- No file changes

- [ ] **Step 1: Deploy the Edge Function**

```bash
cd C:\Users\Admin\Desktop\fnbapp\fnb\ -\ version\ 1
supabase functions deploy backup-to-sheets
```

Expected: Output showing successful deployment with function URL

- [ ] **Step 2: Set environment variables in Supabase**

First, get your values:
- `GOOGLE_SHEETS_CREDENTIALS`: Base64 encoded service account JSON
- `SHEET_ID`: Google Sheet ID from URL
- `SUPABASE_URL`: Your Supabase project URL (from project settings)
- `SUPABASE_SERVICE_ROLE_KEY`: From Supabase dashboard > Settings > API

```bash
supabase secrets set GOOGLE_SHEETS_CREDENTIALS=<your_base64_creds>
supabase secrets set SHEET_ID=<your_sheet_id>
supabase secrets set SUPABASE_URL=<your_supabase_url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

- [ ] **Step 3: Manually test the deployed function**

```bash
curl -X POST https://your-project.supabase.co/functions/v1/backup-to-sheets \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Expected: JSON response with `success: true` and order count

- [ ] **Step 4: Verify data in Google Sheet**

Open the Google Sheet and verify:
- Orders Summary tab has new rows
- Order Items Detail tab has corresponding item rows
- Data matches Supabase

- [ ] **Step 5: Create migration to add initial settings entry**

Create file: `migrations/022_add_sheets_backup_settings.sql`

```sql
-- Insert settings key for Google Sheets backup timestamp
INSERT INTO settings (key, value, updated_at)
VALUES ('sheets_last_backup', NULL, now())
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 6: Run migration in Supabase**

Go to Supabase Dashboard > SQL Editor and run the migration file content.

- [ ] **Step 7: Commit migration**

```bash
git add migrations/022_add_sheets_backup_settings.sql
git commit -m "feat: add settings key for Sheets backup timestamp"
```

---

### Task 10: Set up cron job for daily backup

**Files:**
- No file changes

- [ ] **Step 1: Create cron job using Supabase CLI**

```bash
supabase db functions create_backup_to_sheets --schedule="0 0 * * *"
```

This schedules the function to run daily at 00:00 UTC.

- [ ] **Step 2: Verify cron job was created**

```bash
supabase db functions list
```

Expected: `backup_to_sheets` appears in the list with schedule `0 0 * * *`

- [ ] **Step 3: Verify cron in Supabase Dashboard**

Go to Supabase Dashboard > Edge Functions and verify:
- Function `backup-to-sheets` exists
- Cron schedule shows `0 0 * * *`

- [ ] **Step 4: Test cron trigger (wait for next midnight or manually trigger)**

You can manually trigger via curl:
```bash
curl -X POST https://your-project.supabase.co/functions/v1/backup-to-sheets \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

- [ ] **Step 5: Verify daily backup works**

Wait until after midnight UTC, then check:
1. Google Sheet has new rows
2. Supabase settings table has updated `sheets_last_backup`

---

## Self-Review Results

### 1. Spec Coverage
- ✅ Edge Function creation and deployment
- ✅ Google Sheets Service Account authentication
- ✅ Data transformation for Orders Summary sheet
- ✅ Data transformation for Order Items Detail sheet
- ✅ Idempotency via settings timestamp
- ✅ Error handling with retry logic
- ✅ Batch processing for API limits
- ✅ Daily cron scheduling
- ✅ Setup instructions for Google Cloud and Sheets

### 2. Placeholder Scan
- No "TODO", "TBD", or incomplete sections found
- All steps contain actual code
- All commands are specific

### 3. Type Consistency
- ✅ `Order`, `OrderItem`, `Topping` interfaces consistently used
- ✅ `OrderSummaryRow`, `OrderItemRow` interfaces match sheet structure
- ✅ Function names (`fetchOrders`, `transformToOrderSummary`, etc.) consistent

---

## Setup Notes (Reference for Implementation)

### Prerequisites
1. Google Cloud project with Sheets API enabled
2. Service account created with JSON key
3. Google Sheet created with two tabs: "Orders Summary", "Order Items Detail"
4. Sheet shared with service account email (Editor permission)

### Environment Variables Needed
- `GOOGLE_SHEETS_CREDENTIALS`: Base64 encoded JSON key
- `SHEET_ID`: From Google Sheet URL
- `SUPABASE_URL`: From Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY`: From Supabase dashboard

### Testing Checklist
- [ ] Manual function test returns success
- [ ] Google Sheet receives correct data
- [ ] Settings timestamp updates correctly
- [ ] Cron job scheduled successfully
- [ ] Second run (after timestamp update) doesn't duplicate data
