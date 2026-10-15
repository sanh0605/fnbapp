// Where an edit page's back link and form return go: the row's own detail page,
// remembering the list the user came from. Shared by the five Thu chi edit pages.
// detailDir holds the detail pages ("/admin/finance/categories"); listPath is the
// list to fall back to when the user did not come from the row itself.
export function editBackHref(
  rawReturnTo: string,
  detailDir: string,
  id: string,
  listPath: string = detailDir,
): string {
  const own = [`${detailDir}/${encodeURIComponent(id)}`, `${detailDir}/${id}`];
  if (own.some((p) => rawReturnTo === p || rawReturnTo.startsWith(`${p}?`))) return rawReturnTo;

  const list = rawReturnTo.startsWith(`${detailDir}/`) ? listPath : rawReturnTo;
  return `${own[0]}?returnTo=${encodeURIComponent(list)}`;
}
