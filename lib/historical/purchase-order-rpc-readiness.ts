export type PurchaseOrderRpcReadiness =
  | { status: "READY"; detail: string }
  | { status: "NOT_DEPLOYED"; detail: string }
  | { status: "UNSAFE"; detail: string }
  | { status: "ERROR"; detail: string };

export function classifyPurchaseOrderRpcProbe(
  error: { message?: string } | null,
): PurchaseOrderRpcReadiness {
  if (!error) {
    return {
      status: "UNSAFE",
      detail: "Malformed probe payload was accepted",
    };
  }

  const message = String(error.message || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("p_order must be a json object")) {
    return {
      status: "READY",
      detail: "Guard rejected probe payload",
    };
  }
  if (
    normalized.includes("could not find the function") ||
    normalized.includes("schema cache")
  ) {
    return {
      status: "NOT_DEPLOYED",
      detail: "RPC is absent from the schema cache",
    };
  }
  return {
    status: "ERROR",
    detail: message || "Unknown RPC probe error",
  };
}
