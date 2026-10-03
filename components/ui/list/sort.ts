export type SortDir = "asc" | "desc";

/**
 * Stable sort for list rows according to BR-DATA-008.
 * - Strings compared with Vietnamese locale rules and natural numeric collation
 * - Numbers compared by value
 * - Null, undefined, and empty string placed last in both asc and desc
 * - Stable: equal elements retain original relative order
 * - Returns a new array, does not mutate original
 */
export function sortRows<T>(
  rows: T[],
  getValue: (row: T) => string | number | null | undefined,
  dir: SortDir
): T[] {
  const indexed = rows.map((row, index) => ({ row, index, val: getValue(row) }));

  indexed.sort((a, b) => {
    const valA = a.val;
    const valB = b.val;
    const emptyA = valA === null || valA === undefined || valA === "";
    const emptyB = valB === null || valB === undefined || valB === "";

    if (emptyA && emptyB) return a.index - b.index;
    if (emptyA) return 1;
    if (emptyB) return -1;

    let res = 0;
    if (typeof valA === "number" && typeof valB === "number") {
      res = valA < valB ? -1 : valA > valB ? 1 : 0;
    } else {
      res = String(valA).localeCompare(String(valB), "vi", {
        numeric: true,
        sensitivity: "base",
      });
    }

    if (res !== 0) {
      return dir === "asc" ? res : -res;
    }
    return a.index - b.index;
  });

  return indexed.map((item) => item.row);
}

/**
 * Parses and validates sort key and dir from URL search params.
 * Unknown or missing key -> defaultKey / desc (BR-DATA-008: newest code first).
 * Dir other than "desc" -> "asc".
 */
export function parseSort(
  rawKey: string | null | undefined,
  rawDir: string | null | undefined,
  validKeys: string[],
  defaultKey: string
): { key: string; dir: SortDir } {
  if (!rawKey || !validKeys.includes(rawKey)) {
    return { key: defaultKey, dir: "desc" };
  }
  const dir: SortDir = rawDir === "desc" ? "desc" : "asc";
  return { key: rawKey, dir };
}
