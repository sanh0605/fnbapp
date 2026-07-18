/**
 * Verify the migration credential against the service-role key supplied by
 * the runtime. JWT claims are intentionally not decoded or trusted here.
 */
export function isServiceRoleToken(
  providedToken: string,
  serviceRoleKey: string | undefined,
): boolean {
  if (!providedToken || !serviceRoleKey || providedToken.length !== serviceRoleKey.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < providedToken.length; index += 1) {
    mismatch |= providedToken.charCodeAt(index) ^ serviceRoleKey.charCodeAt(index);
  }
  return mismatch === 0;
}
