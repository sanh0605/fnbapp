/**
 * FIFO Inventory Tracker
 *
 * Simulates batch consumption in chronological order. Batches are shared
 * across all orders — consuming from oldest first.
 *
 * Spec: replaces MAC (Moving Average Cost) per User directive 2026-06-20.
 */

export interface LedgerEntry {
  id: string;
  item_reference: string;
  transaction_type: string;
  unit_cost: string | number;
  quantity_change: string | number;
  created_at: string;
}

interface Batch {
  id: string;
  remaining: number;
  unit_cost: number;
  received_at: string;
}

export class FIFOTracker {
  private batchesByIngredient = new Map<string, Batch[]>();
  private initialized = false;

  /** Initialize from inventory events in chronological order. */
  init(ledger: LedgerEntry[]): void {
    this.batchesByIngredient.clear();
    this.initialized = true;

    const events = ledger
      .filter(e => (
        e.transaction_type === "PO_RECEIPT" ||
        e.transaction_type === "SALES_CONSUME" ||
        e.transaction_type === "PRODUCTION_CONSUME"
      ))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const event of events) {
      if (event.transaction_type === "PO_RECEIPT") {
        this.addBatch(event);
        continue;
      }

      const qty = Math.abs(Number(event.quantity_change) || 0);
      if (qty > 0) this.consume(event.item_reference, qty);
    }
  }

  private addBatch(entry: LedgerEntry): void {
    const ingId = entry.item_reference;
    if (!this.batchesByIngredient.has(ingId)) {
      this.batchesByIngredient.set(ingId, []);
    }
    this.batchesByIngredient.get(ingId)!.push({
      id: entry.id,
      remaining: Number(entry.quantity_change) || 0,
      unit_cost: Number(entry.unit_cost) || 0,
      received_at: entry.created_at,
    });
  }

  /**
   * Consume `qty` units of `ingredientId` from oldest batches first.
   * Returns total cost. If insufficient stock, consumes what's available
   * (returns partial cost — caller should detect shortfall if needed).
   *
   * IMPORTANT: Mutates batch state. Must process orders in chronological order.
   */
  consume(ingredientId: string, qty: number): number {
    if (!this.initialized) {
      throw new Error("FIFOTracker.consume called before init()");
    }
    if (qty <= 0) return 0;

    const batches = this.batchesByIngredient.get(ingredientId);
    if (!batches || batches.length === 0) return 0;

    let remaining = qty;
    let totalCost = 0;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(batch.remaining, remaining);
      totalCost += take * batch.unit_cost;
      batch.remaining -= take;
      remaining -= take;
    }
    // If remaining > 0 here, we had insufficient stock. Caller can call
    // getShortfall() if needed.
    return totalCost;
  }

  /** Get current remaining qty for an ingredient. Useful for diagnostics. */
  getRemaining(ingredientId: string): number {
    const batches = this.batchesByIngredient.get(ingredientId) || [];
    return batches.reduce((s, b) => s + b.remaining, 0);
  }

  /** Total batches tracked. */
  size(): number {
    let total = 0;
    for (const batches of this.batchesByIngredient.values()) {
      total += batches.length;
    }
    return total;
  }
}
