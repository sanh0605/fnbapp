import crypto from 'crypto';

/**
 * Băm chuỗi bằng thuật toán SHA-256 để so sánh với dữ liệu cũ từ Supabase.
 */
export function hashPasswordSHA256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
