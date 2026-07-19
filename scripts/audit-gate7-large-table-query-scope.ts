import { performance } from "node:perf_hooks";
import * as dotenv from "dotenv";
import { toSaigonUtcRange } from "../lib/report-time";

dotenv.config({ path: ".env.local", quiet: true });
process.env.CLI_MODE = "true";

type Row = {
  id: string;
  order_id?: string;
  parent_order_id?: string;
  status?: string;
  created_at?: string;
};

async function timed<T>(label: string, operation: () => Promise<T>) {
  const startedAt = performance.now();
  const value = await operation();
  return {
    label,
    value,
    elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10,
  };
}

function ids(rows: Row[]): string[] {
  return rows.map(row => row.id).sort((left, right) => left.localeCompare(right));
}

function assertSameIds(label: string, expected: Row[], actual: Row[]) {
  const expectedIds = ids(expected);
  const actualIds = ids(actual);
  if (JSON.stringify(expectedIds) !== JSON.stringify(actualIds)) {
    throw new Error(
      `${label}: row-set mismatch (expected ${expectedIds.length}, received ${actualIds.length})`,
    );
  }
}

function currentSaigonDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const {
    findAllNoCache,
    findAllWhere,
    findAllWhereInBatches,
    findById,
  } = await import("../lib/sheets_db");
  const endDate = currentSaigonDate();
  const startDate = `${endDate.slice(0, 7)}-01`;
  const dateRange = toSaigonUtcRange(startDate, endDate);
  if (!dateRange) throw new Error("Could not build the current-month date range");

  const [allOrdersRead, allLinesRead, allEventsRead, stockLedgerRead] = await Promise.all([
    timed("all orders", () => findAllNoCache("Orders_V2") as Promise<Row[]>),
    timed("all order lines", () => findAllNoCache("Order_Lines_V2") as Promise<Row[]>),
    timed("all order events", () => findAllNoCache("Order_Events") as Promise<Row[]>),
    timed("all stock ledger", () => findAllNoCache("Stock_Ledger") as Promise<Row[]>),
  ]);

  const expectedReportOrders = allOrdersRead.value.filter(order => {
    if (order.status !== "COMPLETED" || !order.created_at) return false;
    const createdAt = new Date(order.created_at);
    return createdAt >= dateRange.startUtc && createdAt <= dateRange.endUtc;
  });
  const scopedOrdersRead = await timed("scoped report orders", () => findAllWhere<Row>(
    "Orders_V2",
    {
      eq: { status: "COMPLETED" },
      gte: { created_at: dateRange.startUtc },
      lte: { created_at: dateRange.endUtc },
    },
  ));
  assertSameIds("report orders", expectedReportOrders, scopedOrdersRead.value);

  const reportOrderIds = new Set(scopedOrdersRead.value.map(order => order.id));
  const expectedReportLines = allLinesRead.value.filter(line => (
    line.order_id && reportOrderIds.has(line.order_id)
  ));
  const scopedLinesRead = await timed("scoped report lines", () => findAllWhereInBatches<Row>(
    "Order_Lines_V2",
    "order_id",
    Array.from(reportOrderIds),
  ));
  assertSameIds("report lines", expectedReportLines, scopedLinesRead.value);

  const detailTarget = [...scopedOrdersRead.value]
    .sort((left, right) => (
      new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
    ))[0];
  let detailSummary: Record<string, unknown> = { skipped: true };
  if (detailTarget) {
    const rootId = detailTarget.parent_order_id || detailTarget.id;
    const expectedChain = allOrdersRead.value.filter(order => (
      order.id === rootId || order.parent_order_id === rootId
    ));
    const detailRead = await timed("scoped order detail", async () => {
      const current = await findById("Orders_V2", detailTarget.id) as Row | null;
      if (!current) throw new Error(`Detail target ${detailTarget.id} disappeared`);
      const [root, children] = await Promise.all([
        rootId === current.id
          ? Promise.resolve(current)
          : findById("Orders_V2", rootId) as Promise<Row | null>,
        findAllWhere<Row>("Orders_V2", { eq: { parent_order_id: rootId } }),
      ]);
      const chainById = new Map<string, Row>();
      for (const order of [root, current, ...children]) {
        if (order?.id) chainById.set(order.id, order);
      }
      const chain = Array.from(chainById.values());
      const chainIds = chain.map(order => order.id);
      const [lines, events] = await Promise.all([
        findAllWhereInBatches<Row>("Order_Lines_V2", "order_id", [current.id]),
        findAllWhereInBatches<Row>("Order_Events", "order_id", chainIds),
      ]);
      return { chain, lines, events };
    });

    assertSameIds("order detail chain", expectedChain, detailRead.value.chain);
    assertSameIds(
      "order detail lines",
      allLinesRead.value.filter(line => line.order_id === detailTarget.id),
      detailRead.value.lines,
    );
    const chainIds = new Set(expectedChain.map(order => order.id));
    assertSameIds(
      "order detail events",
      allEventsRead.value.filter(event => event.order_id && chainIds.has(event.order_id)),
      detailRead.value.events,
    );
    detailSummary = {
      orderId: detailTarget.id,
      oldOrdersRead: allOrdersRead.value.length,
      newOrdersRead: detailRead.value.chain.length,
      oldLinesRead: allLinesRead.value.length,
      newLinesRead: detailRead.value.lines.length,
      oldEventsRead: allEventsRead.value.length,
      newEventsRead: detailRead.value.events.length,
      scopedElapsedMs: detailRead.elapsedMs,
    };
  }

  console.log("=== GATE 7 LARGE-TABLE QUERY SCOPE AUDIT (READ ONLY) ===");
  console.log(`Report window: ${startDate} through ${endDate} (Asia/Ho_Chi_Minh)`);
  console.log(`Orders: full=${allOrdersRead.value.length} (${allOrdersRead.elapsedMs} ms), scoped=${scopedOrdersRead.value.length} (${scopedOrdersRead.elapsedMs} ms)`);
  console.log(`Order lines: full=${allLinesRead.value.length} (${allLinesRead.elapsedMs} ms), scoped=${scopedLinesRead.value.length} (${scopedLinesRead.elapsedMs} ms)`);
  console.log(`Order events: full=${allEventsRead.value.length} (${allEventsRead.elapsedMs} ms)`);
  console.log(`Stock ledger: full=${stockLedgerRead.value.length} (${stockLedgerRead.elapsedMs} ms), intentionally retained for current-stock/MAC history`);
  console.log(`Detail sample: ${JSON.stringify(detailSummary)}`);
  console.log("Row-set parity: PASS");
  console.log("No data was written.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
