// Pure logic for assigning the next outlet code, extracted out of
// app/admin/outlets/actions.ts (a "use server" file, which may only export
// async functions -- CLAUDE.md section 9 records the 2026-08-05 incident
// caused by breaking that rule) so the derivation is directly unit-testable
// without mocking the database.
//
// section 2:
// the code is assigned as max(code) + 1, never chosen by the user and never
// taken from a freed gap -- a retired outlet's code stays counted forever
// because the caller passes every outlet's code, active or not.
export function nextOutletCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const n = parseInt(code, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, "0");
}
