// Batch 1, item A (docs/superpowers/plans/2026-08-19-batch-1-foundations.md
// section A). The application-layer half of the two-layer guard -- the
// database partial expression index (see the matching migration) is the
// part that cannot be bypassed; this is the part that turns its raw
// unique-violation into a Vietnamese message the owner can act on, naming
// the row that already holds the name (duplicateNameErrorMessage below).
//
// Mirrors the migration's SQL expression exactly, same order of operations,
// so the app check and the index can never disagree about what counts as a
// duplicate:
//   lower(regexp_replace(btrim(normalize(replace(name, chr(160), ' '), NFC)), '\s+', ' ', 'g'))
//
// Scoped per table, never across tables (section A1): the purchased item
// and the ingredient it becomes legitimately share a name. Callers pass
// only the rows of the one table being checked.

const NBSP = String.fromCharCode(160); // not a literal char here -- see comment above

/**
 * Normalises a name the same way the database index does, so a name the
 * app accepts is never refused by the index and vice versa.
 *
 * Postgres btrim(text) with no second argument trims plain spaces only,
 * not the full \s class -- trimmed here the same narrow way, before the
 * later \s+ collapse (which does use the full whitespace class, matching
 * regexp_replace's default) has a chance to turn a leading/trailing tab
 * into a space that survives. Getting this order wrong is exactly the kind
 * of mismatch that would make the app say "fine" and the index refuse it.
 */
export function normalizeNameForComparison(name: string): string {
  const noNbsp = name.split(NBSP).join(" ");
  const nfc = noNbsp.normalize("NFC");
  const spaceTrimmed = nfc.replace(/^ +/, "").replace(/ +$/, "");
  const collapsed = spaceTrimmed.replace(/\s+/g, " ");
  return collapsed.toLowerCase();
}

export type NamedRow = { id: string; name: string; status?: string };

/**
 * Finds an ACTIVE row (excluding excludeId) whose name normalises to the
 * same value as `name`, within the given row set only. Callers pass one
 * table's own rows -- this never compares across tables.
 */
export function findDuplicateActiveName<T extends NamedRow>(
  rows: T[],
  name: string,
  excludeId?: string,
): T | null {
  const target = normalizeNameForComparison(name);
  return (
    rows.find(
      r =>
        r.id !== excludeId &&
        (r.status ?? "ACTIVE") === "ACTIVE" &&
        // A row with no usable name (e.g. a caller accidentally passing a
        // different table's rows) cannot collide with anything -- skip
        // rather than throw, so a mismatched fetch fails safe, not loudly
        // mid-save.
        typeof r.name === "string" &&
        r.name.length > 0 &&
        normalizeNameForComparison(r.name) === target,
    ) ?? null
  );
}

/** Vietnamese message naming the row that already holds the name (section A2). */
export function duplicateNameErrorMessage(conflict: NamedRow): string {
  return `Tên này đã có rồi: "${conflict.name}" (mã ${conflict.id}).`;
}
