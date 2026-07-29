/**
 * Decides whether the purchase-order form should render on the detail page.
 * A DRAFT is always editable by anyone with a session. A COMPLETED PO is
 * editable only by an admin who explicitly opted in via ?edit=1 -- viewing
 * a completed PO must never open the form by itself.
 */

export function resolvePurchaseOrderEditGate(input: {
  role: string;
  editRequested: boolean;
  isDraft: boolean;
}): { showForm: boolean } {
  const isAdmin = input.role === "ADMIN";
  const showForm = input.isDraft || (isAdmin && input.editRequested);
  return { showForm };
}
