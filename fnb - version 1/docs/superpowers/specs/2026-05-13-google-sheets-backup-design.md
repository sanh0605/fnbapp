# Google Sheets Backup Design
**Date:** 2026-05-13
**Status:** Approved

## Overview

Automated daily backup of orders from Supabase to Google Sheets as a safety net if Supabase ends free tier.

### Problem Statement
Supabase may stop providing free tier in the future. Orders (revenue data) is the most critical business data that must be preserved. A backup solution is needed to prevent data loss.

### Success Criteria
1. Orders are backed up to Google Sheets daily at midnight UTC
2. Backup runs automatically without manual intervention
3. Failed backups are logged and retry on next run
4. No duplicate orders in backup (idempotent)
5. Both order summary and item details are preserved for analysis

---

## Architecture

### System Flow
```
Supabase Database (orders table)
           ↓ (daily cron at 00:00 UTC)
Supabase Edge Function (backup-to-sheets)
           ↓ (Service Account auth)
Google Sheets API
           ↓
Google Sheet (Phin Đi Orders Backup)
```

### Components
1. **Supabase Edge Function** - `backup-to-sheets`: Fetches orders, transforms data, writes to Google Sheets
2. **Cron Job** - Triggers function daily at midnight UTC
3. **Google Sheet** - Contains 2 tabs: Orders Summary, Order Items Detail
4. **Settings Table** - Stores `sheets_last_backup` timestamp for idempotency

---

## Data Model

### Google Sheet Structure

**Sheet Name:** `Phin Đi Orders Backup`

#### Sheet 1: Orders Summary
| Column | Type | Description | Example |
|--------|------|-------------|----------|
| Order ID | Text | UUID from Supabase | `550e8400-e29b-41d4-a716-446655440000` |
| Order # | Text | Order number | `#001` |
| Date | Date | Order date (yyyy-mm-dd) | `2026-05-13` |
| Time | Text | Order time (HH:MM:SS) | `14:32:15` |
| Outlet | Text | Outlet ID and name | `CF_O1 - CF Sáng — Cơ sở 1` |
| Brand | Text | Brand ID and name | `CF_SANG - Cà Phê Sáng` |
| Staff | Text | Staff name | `Nguyễn Văn A` |
| Total Items | Number | Total quantity in order | `3` |
| Subtotal | Number | Before discount | `65000` |
| Discount Amount | Number | Discount applied | `5000` |
| Payable | Number | After discount | `60000` |
| Actual Received | Number | Customer paid | `70000` |
| Change | Number | Change given | `10000` |
| Payment Method | Text | "Tiền mặt" or "Chuyển khoản" | `Tiền mặt` |
| Voided | Text | "TRUE" or "FALSE" | `FALSE` |
| Backup At | Text | ISO timestamp when backed up | `2026-05-13T14:32:15.123Z` |

#### Sheet 2: Order Items Detail
| Column | Type | Description | Example |
|--------|------|-------------|----------|
| Order ID | Text | Link to Orders Summary | `550e8400...` |
| Order # | Text | Reference | `#001` |
| Item ID | Text | Product UUID | `00000000-0000-0000-0000-000000000001` |
| Product Name | Text | Product name | `Cà phê sữa` |
| Category | Text | Product category | `Cà phê` |
| Quantity | Number | Item quantity | `2` |
| Unit Price | Number | Price per unit | `20000` |
| Item Total | Number | Quantity × Unit Price | `40000` |
| Sweetness | Text | Sweet level | `50%` |
| Ice Level | Text | Ice level | `Ít đá` |
| Toppings | Text | Comma-separated toppings | `Kem muối, Trân châu` |
| Toppings Price | Number | Total toppings cost | `5000` |
| Note | Text | Item-level note | `Không ngọt` |
| Backup At | Text | ISO timestamp when backed up | `2026-05-13T14:32:15.123Z` |

---

## Edge Function Specification

### Function: `backup-to-sheets`

**Location:** `supabase/functions/backup-to-sheets/index.ts`

**Environment Variables:**
| Variable | Description | Example |
|----------|-------------|----------|
| `GOOGLE_SHEETS_CREDENTIALS` | Service account JSON key (base64 encoded) | `eyJhbGc...` |
| `SHEET_ID` | Google Sheet ID from URL | `1BxiM...` |
| `SUPABASE_SERVICE_ROLE_KEY` | For Supabase admin access | `eyJhb...` |

**Cron Schedule:** `0 0 * * *` (daily at 00:00 UTC)

### Data Transformation

#### Orders Summary Row
```typescript
{
  orderId: order.id,
  orderNum: order.order_num,
  date: formatYYYYMMDD(order.created_at),
  time: formatHHMMSS(order.created_at),
  outlet: `${order.outlet_id} - ${getOutletName(order.outlet_id)}`,
  brand: `${order.brand_id} - ${getBrandName(order.brand_id)}`,
  staff: order.staff_name || 'N/A',
  totalItems: sum(order.items.map(i => i.qty)),
  subtotal: order.subtotal || 0,
  discountAmount: order.discount_amount || 0,
  payable: order.total,
  actualReceived: order.actual_received || order.total,
  change: Math.max(0, (order.actual_received || order.total) - order.total),
  paymentMethod: order.method,
  voided: order.voided ? 'TRUE' : 'FALSE',
  backupAt: new Date().toISOString()
}
```

#### Order Items Detail Row
```typescript
order.items.forEach(item => {
  rows.push({
    orderId: order.id,
    orderNum: order.order_num,
    itemId: item.id,
    productName: item.name,
    category: getProductCategory(item.id),
    quantity: item.qty,
    unitPrice: item.price,
    itemTotal: item.qty * item.price,
    sweetness: item.sweet || '100%',
    iceLevel: item.ice || 'Bình thường',
    toppings: (item.toppings || []).map(t => t.name).join(', '),
    toppingsPrice: (item.toppings || []).reduce((s, t) => s + t.price, 0),
    note: item.note || '',
    backupAt: new Date().toISOString()
  })
})
```

### Logic Flow
1. Read `sheets_last_backup` from settings table
2. If not exists (first run): fetch orders from last 30 days
3. If exists: fetch orders where `created_at > last_backup_timestamp`
4. Transform each order into Orders Summary row
5. Transform each item into Order Items Detail row
6. Write batches to Google Sheets API
7. On success: update `sheets_last_backup` to current time
8. Log result (count, duration, errors)

### Error Handling
| Error Type | Handling |
|-----------|-----------|
| Google Sheets quota exceeded | Retry with exponential backoff (1s, 2s, 4s) |
| Sheet not found | Auto-create sheet with headers |
| Auth failure | Log to Supabase logs, retry next day |
| Network timeout | Retry once after 2 seconds |
| Partial failure (some rows) | Log failed IDs, retry next run |
| Supabase query error | Log error, return 500 to trigger retry |
| Data transformation error | Skip problematic order, log warning |

---

## Idempotency & Duplicate Prevention

1. **First run (no timestamp):** Backup last 30 days of orders
2. **Subsequent runs:** Use `last_backup_timestamp` from settings table
3. **After success:** Update `sheets_last_backup` to current UTC time
4. **Handling gaps:** If run is skipped, next run backs up all orders since last successful timestamp

---

## Setup Instructions

### Step 1: Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create new sheet: "Phin Đi Orders Backup"
3. Create two tabs: "Orders Summary", "Order Items Detail"
4. Add headers as specified in Data Model section
5. Copy Sheet ID from URL: `docs.google.com/spreadsheets/d/`**`SHEET_ID`**`/edit`

### Step 2: Create Google Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project (or use existing)
3. Navigate to APIs & Services > Library
4. Enable "Google Sheets API"
5. Navigate to APIs & Services > Credentials
6. Create Service Account
7. Download JSON key
8. Convert to base64: `base64 -i key.json` on Mac/Linux or use online tool

### Step 3: Share Sheet with Service Account
1. Open Google Sheet
2. Click "Share" button
3. Add service account email: `xxx@xxx.iam.gserviceaccount.com`
4. Give "Editor" permission

### Step 4: Deploy Edge Function
```bash
supabase functions deploy backup-to-sheets
supabase secrets set GOOGLE_SHEETS_CREDENTIALS=<base64_json>
supabase secrets set SHEET_ID=<your_sheet_id>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your_key>
```

### Step 5: Create Cron Job
```bash
supabase functions deploy backup-to-sheets --no-verify-jwt
supabase db functions create_backup_to_sheets --schedule="0 0 * * *"
```

---

## Testing & Verification

### Manual Test Trigger
```bash
curl -X POST https://your-project.supabase.co/functions/v1/backup-to-sheets \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Check Backup Status (SQL)
```sql
SELECT * FROM settings WHERE key = 'sheets_last_backup';
```

### Verify in Google Sheets
1. Check that new orders appear daily
2. Verify order totals match Supabase
3. Check that items detail is complete
4. Confirm no duplicate orders

---

## Monitoring

### Logs to Watch
- Backup start time
- Orders processed count
- Any errors or warnings
- Backup duration
- Success/failure status

### Alerting (Optional)
If backup fails multiple days, consider adding notification via:
- Email notification
- Toast message in admin panel

---

## Files to Create

| Path | Description |
|------|-------------|
| `supabase/functions/backup-to-sheets/index.ts` | Main Edge Function logic |
| `supabase/functions/backup-to-sheets/tsconfig.json` | TypeScript config |
| `supabase/functions/backup-to-sheets/package.json` | Dependencies (googleapis) |

---

## Security Considerations

1. **Service Account Key:** Stored as base64 in Supabase secrets, never exposed to client
2. **Supabase Service Role Key:** Used only in Edge Function, bypasses RLS for admin access
3. **Cron Job:** Protected by Supabase Edge Function authentication

---

## Future Enhancements (Out of Scope)

- Restore from Google Sheets to Supabase
- Real-time backup on order creation
- Backup other tables (products, settings, etc.)
- Web UI to trigger manual backup
- Backup status dashboard in admin panel
