const LIST = "/admin/suppliers";
const PO_DEFAULT = "/admin/inventory/purchase-orders/new?draft=1";
const PO_RETURN_TO_REGEX = /^\/admin\/inventory\/purchase-orders\/(new|[A-Za-z0-9_-]+)(\?[^#]*)?$/;

const SUPPLIER_DETAIL_REGEX = /^\/admin\/suppliers\/([A-Za-z0-9_-]+)(\?[^#]*)?$/;

// Only a path inside the suppliers screen is accepted, so a crafted link
// cannot send the user off-site after saving.
export function safeReturnTo(raw: string | undefined | null): string {
  if (!raw) return LIST;
  if (raw === LIST || raw.startsWith(`${LIST}?`)) return raw;
  const match = raw.match(SUPPLIER_DETAIL_REGEX);
  if (match && match[1] !== "new") {
    return raw;
  }
  return LIST;
}

export function safePoReturnTo(raw: string | undefined | null): string {
  if (!raw) return PO_DEFAULT;
  if (PO_RETURN_TO_REGEX.test(raw)) return raw;
  return PO_DEFAULT;
}

