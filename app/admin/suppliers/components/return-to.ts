const PO_DEFAULT = "/admin/inventory/purchase-orders/new?draft=1";
const PO_RETURN_TO_REGEX = /^\/admin\/inventory\/purchase-orders\/(new|[A-Za-z0-9_-]+)(\?[^#]*)?$/;

export function safePoReturnTo(raw: string | undefined | null): string {
  if (!raw) return PO_DEFAULT;
  if (PO_RETURN_TO_REGEX.test(raw)) return raw;
  return PO_DEFAULT;
}

