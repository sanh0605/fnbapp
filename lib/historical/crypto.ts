import crypto from 'crypto';

/**
 * HISTORICAL (Plan E E3, 2026-08-11) -- see lib/historical/README.md.
 * Verified real password changes in app/actions/auth.ts until commit
 * fe04f4a ("repair password change and remove legacy backup page")
 * replaced it with bcrypt.compare. Kept as the record of the pre-bcrypt
 * verification method; not imported anywhere live.
 *
 * Băm chuỗi bằng thuật toán SHA-256 để so sánh với dữ liệu cũ từ Supabase.
 */
export function hashPasswordSHA256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
