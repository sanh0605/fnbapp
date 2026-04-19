// src/lib/supabase.js
// Kết nối Supabase — dùng chung toàn bộ app

async function hashPassword(pwd) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

const SUPABASE_URL  = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'sb_publishable_rhbewMyE6ws9G3_DSmEbfg_w0omMwFI';

// ── HTTP helpers ──
async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${SUPABASE_ANON}`,
      'Content-Type':  'application/json',
      'Prefer':        options.prefer || '',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const DB = {
  // SELECT
  select: (table, query = '') =>
    sb(`${table}?${query}`, { method: 'GET' }),

  // INSERT
  insert: (table, data, returning = true) =>
    sb(table, {
      method:  'POST',
      body:    JSON.stringify(data),
      prefer:  returning ? 'return=representation' : 'return=minimal',
    }),

  // UPDATE
  update: (table, match, data) =>
    sb(`${table}?${match}`, {
      method:  'PATCH',
      body:    JSON.stringify(data),
      prefer:  'return=representation',
    }),

  // UPSERT
  upsert: (table, data) =>
    sb(table, {
      method:  'POST',
      body:    JSON.stringify(data),
      prefer:  'resolution=merge-duplicates,return=representation',
    }),

  // DELETE
  delete: (table, match) =>
    sb(`${table}?${match}`, { method: 'DELETE' }),

  // RPC
  rpc: (fn, params = {}) =>
    sb(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(params) }),
};