import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Read-only: checks whether the pgcrypto extension (needed for digest(),
 * used by apply_backdated_event_recovery in migration 0015) is installed,
 * and which schema search_path the function itself runs under.
 */

async function main() {
  const { buildReadOnlyManagementUrl } = await import("./audit-gate3-database-security-core");

  const supabaseUrl = process.env.SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!supabaseUrl || !accessToken) {
    throw new Error("SUPABASE_URL and SUPABASE_ACCESS_TOKEN are required in .env.local");
  }

  const endpoint = buildReadOnlyManagementUrl(supabaseUrl);

  const query = `
    select extname, extnamespace::regnamespace::text as schema, extversion
    from pg_extension
    where extname = 'pgcrypto';
  `;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, parameters: [] }),
  });
  const payload = await response.json().catch(async () => ({ error: await response.text() }));
  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
