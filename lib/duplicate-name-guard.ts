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

// Section A3b, owner decision 2026-08-19: level 1 (above) refuses an exact
// match; level 2 only WARNS when names match after stripping diacritics --
// "Ca phe" against "Cà phê" -- because stripping is not safe to refuse on
// outright. Measured: it also collapses "Dứa" and "Dừa" (pineapple vs
// coconut) into one word, and this catalogue already holds "Thạch dừa"
// (NNL-009), so a blanket refusal would one day block "Thạch dứa" on a
// drinks menu with no way for the owner to say "that is a real, different
// item." Level 2 asks instead of refusing, and records the answer.

/**
 * đ/Đ (U+0111/U+0110) do NOT decompose under NFD -- verified directly
 * (đ.normalize("NFD") stays one codepoint, unlike á which splits into a +
 * a combining acute). NFD-plus-combining-mark-removal alone would silently
 * leave đ untouched, so "Da vien" would never match "Đá viên" and the
 * warning would look like it "just doesn't fire sometimes" (section A5).
 * Replaced explicitly before the NFD strip runs.
 */
const D_WITH_STROKE: Record<string, string> = { đ: "d", Đ: "D" };

// Built via RegExp(string) rather than a /[...]/g literal -- a literal
// combining-mark character sitting directly in this source file would be
// exactly the invisible-character hazard this whole feature exists to
// catch, indistinguishable on screen from the character it is meant to
// strip. String.fromCharCode(0x300, 0x36f) names the U+0300-U+036F
// combining diacritical marks block explicitly instead.
const COMBINING_MARKS_PATTERN = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

export function stripDiacritics(input: string): string {
  const dReplaced = Array.from(input)
    .map(ch => D_WITH_STROKE[ch] ?? ch)
    .join("");
  return dReplaced.normalize("NFD").replace(COMBINING_MARKS_PATTERN, "");
}

export type DuplicateWarning<T extends NamedRow> = {
  conflict: T;
};

/**
 * Finds an ACTIVE row whose name matches only after stripping diacritics --
 * never a row level 1 (findDuplicateActiveName) would already refuse, so
 * the two levels never both fire on the same conflict. Same per-table
 * scoping rule as level 1: callers pass only the rows of the one table
 * being checked.
 */
export function findDiacriticStrippedMatch<T extends NamedRow>(
  rows: T[],
  name: string,
  excludeId?: string,
): DuplicateWarning<T> | null {
  const normalizedTarget = normalizeNameForComparison(name);
  const strippedTarget = stripDiacritics(normalizedTarget);
  const conflict = rows.find(r => {
    if (r.id === excludeId) return false;
    if ((r.status ?? "ACTIVE") !== "ACTIVE") return false;
    if (typeof r.name !== "string" || r.name.length === 0) return false;
    const normalizedRow = normalizeNameForComparison(r.name);
    if (normalizedRow === normalizedTarget) return false; // level 1's territory, not level 2's
    return stripDiacritics(normalizedRow) === strippedTarget;
  });
  return conflict ? { conflict } : null;
}

/** Vietnamese message asking whether the near-match is really a different item (section A3b). */
export function duplicateWarningMessage(conflict: NamedRow): string {
  return `Tên này gần giống "${conflict.name}" (mã ${conflict.id}). Đây có phải là một mặt hàng khác không?`;
}
