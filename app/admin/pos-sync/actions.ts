"use server";

import { findAllNoCache, update } from "@/lib/sheets_db";
import { requireAdmin } from "@/lib/auth";

export interface PosSyncLateOrder {
  id: string;
  order_no: string;
  created_at: string;
  synced_at: string;
  delayMinutes: number;
}

export interface PosSyncFailureItem {
  id: string;
  request_token: string;
  error_message: string;
  occurred_at: string;
}

const LATE_THRESHOLD_MINUTES = 5;

export async function getPosSyncAttentionItems(): Promise<{
  lateOrders: PosSyncLateOrder[];
  failures: PosSyncFailureItem[];
}> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [orders, syncFailures] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Pos_Sync_Failures"),
  ]);

  const lateOrders: PosSyncLateOrder[] = [];
  for (const order of orders as any[]) {
    if (!order.synced_at || !order.created_at) continue;
    const delayMinutes = (new Date(order.synced_at).getTime() - new Date(order.created_at).getTime()) / 60000;
    if (delayMinutes > LATE_THRESHOLD_MINUTES) {
      lateOrders.push({
        id: order.id,
        order_no: order.order_no,
        created_at: order.created_at,
        synced_at: order.synced_at,
        delayMinutes: Math.round(delayMinutes),
      });
    }
  }

  const failures: PosSyncFailureItem[] = (syncFailures as any[])
    .filter(f => !f.resolved)
    .map(f => ({
      id: f.id,
      request_token: f.request_token,
      error_message: f.error_message,
      occurred_at: f.occurred_at,
    }));

  return { lateOrders, failures };
}

export async function resolvePosSyncFailure(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await update("Pos_Sync_Failures", id, { resolved: true });
  return { success: true };
}
