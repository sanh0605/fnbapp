/**
 * Ping Supabase project to verify credentials work.
 *
 * Tests:
 *   1. SUPABASE_URL + SUPABASE_SECRET_KEY env vars present
 *   2. REST API (PostgREST) responds to authenticated request
 *   3. Service role bypasses RLS (can list tables)
 *
 * Usage: vite-node scripts/supabase-ping.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log("=== Supabase Ping ===");
  console.log(`URL: ${url || "(missing)"}`);
  console.log(`Secret key: ${secretKey ? `${secretKey.slice(0, 12)}...${secretKey.slice(-4)} (${secretKey.length} chars)` : "(missing)"}`);
  console.log(`Publishable key: ${publishableKey ? `${publishableKey.slice(0, 12)}...${publishableKey.slice(-4)} (${publishableKey.length} chars)` : "(missing, optional)"}`);
  console.log();

  if (!url || !secretKey) {
    console.error("FAIL: SUPABASE_URL and SUPABASE_SECRET_KEY are required in .env.local");
    process.exit(1);
  }

  // Test 1: PostgREST root — lists available tables/edges
  console.log("Test 1: GET /rest/v1/ (PostgREST root)");
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data: any = await res.json();
      const tables = Object.keys(data.definitions || {});
      console.log(`  Available tables: ${tables.length}`);
      if (tables.length > 0) {
        console.log(`  First 10: ${tables.slice(0, 10).join(", ")}`);
      } else {
        console.log(`  (no tables defined yet — schema chưa được tạo)`);
      }
    } else {
      const text = await res.text();
      console.log(`  Body: ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    console.error(`  ERROR: ${err?.message || err}`);
    process.exit(1);
  }

  // Test 2: Auth health
  console.log();
  console.log("Test 2: GET /auth/v1/health");
  try {
    const res = await fetch(`${url}/auth/v1/health`);
    console.log(`  Status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const data: any = await res.json();
      console.log(`  Body: ${JSON.stringify(data)}`);
    }
  } catch (err: any) {
    console.error(`  ERROR: ${err?.message || err}`);
  }

  // Test 3: Database connectivity via /pg/query or root
  console.log();
  console.log("Test 3: GET / (project root)");
  try {
    const res = await fetch(`${url}/`);
    console.log(`  Status: ${res.status} ${res.statusText}`);
  } catch (err: any) {
    console.error(`  ERROR: ${err?.message || err}`);
  }

  console.log();
  console.log("=== Ping done ===");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
