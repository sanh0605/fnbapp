export function sumCompletedProductionYieldBySemiProduct(
  orders: Array<Record<string, unknown>>,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const order of orders) {
    if (order.status !== "COMPLETED") continue;
    const semiProductId = typeof order.semi_product_id === "string"
      ? order.semi_product_id
      : "";
    const batchYield = Number(order.batch_yield);
    if (!semiProductId || !Number.isFinite(batchYield)) continue;
    result.set(semiProductId, (result.get(semiProductId) || 0) + batchYield);
  }
  return result;
}
