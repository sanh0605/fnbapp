import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

type OrderRow = {
  id: string;
  status?: string;
  superseded_by?: string;
  net_total?: string | number;
};

type LineRow = {
  order_id?: string;
  product_snapshot_json?: string;
  net_line_total?: string | number;
  cost_at_sale?: string | number;
};

type CategoryExpected = {
  categoryId: string;
  revenue: number;
  cogs: number;
  orderCount: number;
};

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines] = await Promise.all([
    findAllNoCache("Orders_V2") as Promise<OrderRow[]>,
    findAllNoCache("Order_Lines_V2") as Promise<LineRow[]>,
  ]);

  const activeOrders = orders.filter(order =>
    order.status === "COMPLETED" && !order.superseded_by,
  );
  const activeOrderIds = new Set(activeOrders.map(order => order.id));
  const activeLines = lines.filter(line => activeOrderIds.has(line.order_id || ""));

  const expectedAll = {
    orderCount: activeOrders.length,
    revenue: sum(activeOrders.map(order => Number(order.net_total) || 0)),
    lineRevenue: sum(activeLines.map(line => Number(line.net_line_total) || 0)),
    cogs: sum(activeLines.map(line => Number(line.cost_at_sale) || 0)),
  };

  const mismatches: string[] = [];
  compare("All active order net_total vs active line net_line_total", expectedAll.revenue, expectedAll.lineRevenue, mismatches);

  const categories = buildCategoryExpected(activeLines);
  const categoryRevenueTotal = sum(categories.map(category => category.revenue));
  const categoryCogsTotal = sum(categories.map(category => category.cogs));
  compare("Category revenue total vs active line revenue", categoryRevenueTotal, expectedAll.lineRevenue, mismatches);
  compare("Category COGS total vs active line COGS", categoryCogsTotal, expectedAll.cogs, mismatches);

  console.log("=== REPORT V2 CONSISTENCY AUDIT (READ ONLY) ===");
  console.log(`Active orders:     ${expectedAll.orderCount}`);
  console.log(`Active lines:      ${activeLines.length}`);
  console.log(`Raw order revenue: ${fmt(expectedAll.revenue)}đ`);
  console.log(`Raw line revenue:  ${fmt(expectedAll.lineRevenue)}đ`);
  console.log(`Raw line COGS:     ${fmt(expectedAll.cogs)}đ`);
  console.log(`Categories:        ${categories.length}`);
  console.log(`Mismatches:        ${mismatches.length}`);
  console.log("\nCategory totals:");
  for (const category of categories) {
    console.log(`${category.categoryId} | orders=${category.orderCount} | revenue=${fmt(category.revenue)}đ | cogs=${fmt(category.cogs)}đ`);
  }

  if (mismatches.length > 0) {
    console.log("\nMismatches:");
    mismatches.forEach((line, index) => console.log(`${index + 1}. ${line}`));
    process.exitCode = 1;
  }

  console.log("\nNo data was written.");
}

function buildCategoryExpected(lines: LineRow[]): CategoryExpected[] {
  const byCategory = new Map<string, { revenue: number; cogs: number; orderIds: Set<string> }>();
  for (const line of lines) {
    const categoryId = getCategoryId(line);
    if (!categoryId) continue;
    let row = byCategory.get(categoryId);
    if (!row) {
      row = { revenue: 0, cogs: 0, orderIds: new Set() };
      byCategory.set(categoryId, row);
    }
    row.revenue += Number(line.net_line_total) || 0;
    row.cogs += Number(line.cost_at_sale) || 0;
    if (line.order_id) row.orderIds.add(line.order_id);
  }
  return [...byCategory.entries()]
    .map(([categoryId, row]) => ({
      categoryId,
      revenue: row.revenue,
      cogs: row.cogs,
      orderCount: row.orderIds.size,
    }))
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function getCategoryId(line: LineRow): string {
  try {
    return String(JSON.parse(line.product_snapshot_json || "{}").category_id || "");
  } catch {
    return "";
  }
}

function compare(label: string, actual: number, expected: number, mismatches: string[]) {
  if (Math.abs(actual - expected) <= 0.001) return;
  mismatches.push(`${label}: actual=${fmt(actual)} expected=${fmt(expected)} delta=${fmt(actual - expected)}`);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function fmt(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("vi-VN");
}

main().catch(error => {
  console.error("FATAL:", error);
  process.exit(1);
});
