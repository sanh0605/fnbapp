// src/lib/supabase.js
// Kết nối Supabase — dùng chung toàn bộ app

const SUPABASE_URL  = 'https://zicuawpwyhmtqmzawvau.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppY3Vhd3B3eWhtdHFtemF3dmF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njc4MzcsImV4cCI6MjA5MTM0MzgzN30.gWia6lTXfHcwewH62i3xjlcqNpZBwLo7U7ig_v5ZcpM';

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
};