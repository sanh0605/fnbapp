// Claude code — Supabase migration Phase E.
//
// Daily sync Supabase → Google Sheets (one-way backup).
//
// Reads orders_v2 + order_lines_v2 from Supabase (incremental via
// sync_state cursor), appends to Google Sheets tabs `Orders_V2` and
// `Order_Lines_V2` for human review/backup.
//
// Env vars (set via `supabase secrets set`):
//   - GOOGLE_CREDENTIALS_BASE64: base64 service account JSON.
//   - GOOGLE_SPREADSHEET_ID: target spreadsheet id.
//   - SUPABASE_URL: project URL.
//   - SUPABASE_SERVICE_ROLE_KEY: service role key.
//
// Trigger: Supabase scheduled function (cron daily, e.g., 02:00 UTC+7).
// Configure in Supabase dashboard → Database → Cron (pg_cron extension).

import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

// ============================================================================
// Types
// ============================================================================

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  private_key_id?: string;
}

interface OrderV2 {
  id: string;
  order_no: string;
  brand_id: string;
  status: string;
  version: number;
  created_at: string;
  created_by_name: string | null;
  completed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  currency: string;
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;
  applied_promotion_id: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  migration_notes: string | null;
}

interface OrderLineV2 {
  id: string;
  order_id: string;
  line_no: number;
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price: number;
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  net_line_total: number;
  cost_at_sale: number;
  created_at: string;
}

// ============================================================================
// OAuth2 — service account JWT flow
// ============================================================================

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64UrlEncode(input: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < input.length; i++) {
    binary += String.fromCharCode(input[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): Uint8Array {
  // Strip PEM headers and parse base64 body.
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(pemContents);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const derBytes = pemToDer(pem);
  return await crypto.subtle.importKey(
    'pkcs8',
    derBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signJwt(payload: object, credentials: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: credentials.private_key_id };
  const claim = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    ...payload,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const claimB64 = base64UrlEncode(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;

  const key = await importPrivateKey(credentials.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(credentialsBase64: string): Promise<string> {
  const credentialsJson = atob(credentialsBase64);
  const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;

  const jwt = await signJwt({}, credentials);

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OAuth failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

// ============================================================================
// Sheets API helpers
// ============================================================================

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function sheetsHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTab: string,
  rows: (string | number | null)[][],
): Promise<void> {
  if (rows.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(`${sheetTab}!A:A`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      const res = await fetch(url, {
        method: 'POST',
        headers: sheetsHeaders(accessToken),
        body: JSON.stringify({ values: batch }),
      });
      if (res.ok) break;
      if (res.status >= 500 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
      const text = await res.text();
      throw new Error(`Sheets append failed (${res.status}): ${text}`);
    }
  }
}

// ============================================================================
// Supabase queries
// ============================================================================

function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

async function getLastSync(supabase: ReturnType<typeof createClient>, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sync_state')
    .select('last_synced_at')
    .eq('sync_key', key)
    .maybeSingle();
  if (error) {
    console.warn(`sync_state read failed (will use default): ${error.message}`);
    return null;
  }
  return data?.last_synced_at || null;
}

async function setLastSync(supabase: ReturnType<typeof createClient>, key: string, iso: string): Promise<void> {
  const { error } = await supabase
    .from('sync_state')
    .upsert({ sync_key: key, last_synced_at: iso }, { onConflict: 'sync_key' });
  if (error) console.warn(`sync_state write failed: ${error.message}`);
}

async function fetchOrdersSince(supabase: ReturnType<typeof createClient>, since: string | null): Promise<OrderV2[]> {
  // First-run default: 7 days back.
  const cutoff = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const all: OrderV2[] = [];
  let page = 0;
  const PAGE = 500;
  while (true) {
    const { data, error } = await supabase
      .from('orders_v2')
      .select('*')
      .gt('created_at', cutoff)
      .order('created_at', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error(`orders_v2 query: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as OrderV2[]));
    if (data.length < PAGE) break;
    page += 1;
  }
  return all;
}

async function fetchLinesForOrders(supabase: ReturnType<typeof createClient>, orderIds: string[]): Promise<OrderLineV2[]> {
  if (orderIds.length === 0) return [];
  const all: OrderLineV2[] = [];
  // Chunk to avoid PostgREST URL length limits.
  const CHUNK = 100;
  for (let i = 0; i < orderIds.length; i += CHUNK) {
    const chunk = orderIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('order_lines_v2')
      .select('*')
      .in('order_id', chunk);
    if (error) throw new Error(`order_lines_v2 query: ${error.message}`);
    if (data) all.push(...(data as OrderLineV2[]));
  }
  return all;
}

// ============================================================================
// Transform to Sheets row format
// ============================================================================

const ORDERS_COLUMNS = [
  'id', 'order_no', 'brand_id', 'status', 'version', 'parent_order_id',
  'superseded_by', 'created_at', 'created_by_id', 'created_by_name',
  'completed_at', 'voided_at', 'voided_by_id', 'void_reason', 'currency',
  'gross_total', 'promo_discount_total', 'manual_item_discount_total',
  'manual_order_discount', 'net_total', 'applied_promotion_id',
  'applied_promotion_snapshot_json', 'pos_snapshot_json', 'payment_method',
  'payment_ref', 'migration_notes',
];

const LINES_COLUMNS = [
  'id', 'order_id', 'line_no', 'product_id', 'product_snapshot_json',
  'variant_id', 'variant_snapshot_json', 'qty', 'unit_price',
  'modifiers_snapshot_json', 'gross_line_total', 'promo_discount',
  'manual_item_discount', 'order_discount_allocation', 'net_line_total',
  'cost_at_sale', 'recipe_snapshot_json', 'promo_discount_reason',
  'manual_discount_reason', 'created_at',
];

function orderToRow(o: any): (string | number | null)[] {
  // Claude code — Phase E fix: full V2 schema with all columns including
  // snapshot JSON + voided_by_id. Previous version omitted these, causing
  // column shift when appended to original sheet.
  return [
    o.id, o.order_no, o.brand_id, o.status, o.version,
    o.parent_order_id || '', o.superseded_by || '',
    o.created_at, o.created_by_id || '', o.created_by_name || '',
    o.completed_at || '', o.voided_at || '',
    o.voided_by_id || '', o.void_reason || '',
    o.currency || 'VND',
    o.gross_total ?? 0, o.promo_discount_total ?? 0,
    o.manual_item_discount_total ?? 0, o.manual_order_discount ?? 0,
    o.net_total ?? 0,
    o.applied_promotion_id || '',
    JSON.stringify(o.applied_promotion_snapshot_json ?? {}),
    JSON.stringify(o.pos_snapshot_json ?? {}),
    o.payment_method || '', o.payment_ref || '',
    o.migration_notes || '',
  ];
}

function lineToRow(l: any): (string | number | null)[] {
  return [
    l.id, l.order_id, l.line_no, l.product_id,
    JSON.stringify(l.product_snapshot_json ?? {}),
    l.variant_id,
    JSON.stringify(l.variant_snapshot_json ?? {}),
    l.qty, l.unit_price,
    JSON.stringify(l.modifiers_snapshot_json ?? []),
    l.gross_line_total ?? 0, l.promo_discount ?? 0,
    l.manual_item_discount ?? 0, l.order_discount_allocation ?? 0,
    l.net_line_total ?? 0, l.cost_at_sale ?? 0,
    JSON.stringify(l.recipe_snapshot_json ?? {}),
    l.promo_discount_reason || '', l.manual_discount_reason || '',
    l.created_at,
  ];
}

// ============================================================================
// Main handler
// ============================================================================

Deno.serve(async (_req) => {
  const startedAt = new Date().toISOString();
  console.log(`[backup-to-sheets] start at ${startedAt}`);

  try {
    const credentialsB64 = Deno.env.get('GOOGLE_CREDENTIALS_BASE64');
    const spreadsheetId = Deno.env.get('GOOGLE_SPREADSHEET_ID');
    if (!credentialsB64 || !spreadsheetId) {
      return new Response(JSON.stringify({ error: 'Missing Google env vars' }), { status: 500 });
    }

    const supabase = getSupabaseClient();
    const accessToken = await getAccessToken(credentialsB64);

    const ordersSince = await getLastSync(supabase, 'orders_v2');
    console.log(`[backup-to-sheets] syncing orders since: ${ordersSince || '(7d default)'}`);

    const orders = await fetchOrdersSince(supabase, ordersSince);
    console.log(`[backup-to-sheets] fetched ${orders.length} orders`);

    if (orders.length === 0) {
      await setLastSync(supabase, 'orders_v2', startedAt);
      return new Response(JSON.stringify({
        success: true,
        message: 'No new orders',
        backupAt: startedAt,
      }), { status: 200 });
    }

    const orderIds = orders.map((o) => o.id);
    const lines = await fetchLinesForOrders(supabase, orderIds);
    console.log(`[backup-to-sheets] fetched ${lines.length} lines`);

    const orderRows = orders.map(orderToRow);
    const lineRows = lines.map(lineToRow);

    // Claude code — Phase E fix: do NOT insert headers. Original sheet
    // already has headers from migration source. Re-inserting causes
    // duplicate header rows + column shift.

    await appendRows(accessToken, spreadsheetId, 'Orders_V2', orderRows);
    await appendRows(accessToken, spreadsheetId, 'Order_Lines_V2', lineRows);

    await setLastSync(supabase, 'orders_v2', startedAt);

    return new Response(JSON.stringify({
      success: true,
      message: `Backed up ${orders.length} orders + ${lines.length} lines`,
      ordersBackedUp: orders.length,
      linesBackedUp: lines.length,
      backupAt: startedAt,
      durationMs: Date.now() - new Date(startedAt).getTime(),
    }), { status: 200 });
  } catch (err) {
    console.error('[backup-to-sheets] failed:', err);
    return new Response(JSON.stringify({
      error: 'Backup failed',
      message: err instanceof Error ? err.message : String(err),
      backupAt: startedAt,
    }), { status: 500 });
  }
});
