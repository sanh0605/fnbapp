export interface PoDraftState {
  supplierId: string;
  sourceId: string;
  supplierInvoiceCode: string;
  transactionDate: string | null;
  notes: string;
  lines: any[];
  shippingFee: number;
  taxAmount: number;
  voucherAmount: number;
  discountAmount: number;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function draftKey(poId: string | undefined | null): string {
  return poId ? `fnb:po-draft:${poId}` : "fnb:po-draft:new";
}

export function saveDraft(
  storage: Storage | null,
  key: string,
  state: PoDraftState,
  now: number,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, state }));
    return true;
  } catch {
    return false;
  }
}

export function takeDraft(
  storage: Storage | null,
  key: string,
  now: number,
): PoDraftState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    storage.removeItem(key);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.savedAt !== "number" || !parsed.state) return null;
    if (now - parsed.savedAt > TWENTY_FOUR_HOURS_MS) return null;
    return parsed.state as PoDraftState;
  } catch {
    return null;
  }
}
