/**
 * Hash plaintext passwords in Supabase users table.
 *
 * Phase D dropped plaintext fallback (security hardening). This script
 * converts any plaintext password_hash to proper bcrypt hash.
 *
 * Usage: vite-node scripts/hash-user-passwords.ts [--apply]
 * Default dry-run: prints which users have plaintext.
 * --apply: updates them with bcrypt hash.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
process.env.CLI_MODE = 'true';

async function main() {
  const apply = process.argv.includes('--apply');
  const { getSupabaseClient } = await import('../lib/supabase');
  const bcrypt = (await import('bcryptjs')).default;

  const supabase = getSupabaseClient();
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username, password_hash, role');
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const isBcryptHash = (s: string) => typeof s === 'string' && /^\$2[aby]\$\d{2}\$/.test(s);
  const plaintext = (users || []).filter((u: any) => !isBcryptHash(u.password_hash));

  console.log(`=== HASH USER PASSWORDS (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Total users: ${users?.length || 0}`);
  console.log(`Plaintext (need hash): ${plaintext.length}`);

  if (plaintext.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  for (const u of plaintext) {
    const current = String(u.password_hash);
    const hashed = await bcrypt.hash(current, 10);
    console.log(`  ${u.username} (${u.role}): plaintext="${current}" → hash=${hashed.slice(0, 30)}...`);
    if (apply) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashed })
        .eq('id', u.id);
      if (updateError) {
        console.error(`    FAILED: ${updateError.message}`);
      } else {
        console.log(`    Updated.`);
      }
    }
  }

  if (!apply) {
    console.log('\nNo data was written. Re-run with --apply to hash.');
    return;
  }

  // Verify.
  const { data: after } = await supabase
    .from('users')
    .select('id, username, password_hash')
    .in('id', plaintext.map((u: any) => u.id));
  const stillPlaintext = (after || []).filter((u: any) => !isBcryptHash(u.password_hash));
  console.log(`\nPost-apply: ${stillPlaintext.length} plaintext remaining.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
