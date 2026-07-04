import { findAll } from "@/lib/sheets_db";
import BackupClient from "./components/BackupClient";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const syncStateList = await findAll("Sync_State");
  const ordersSync = syncStateList.find((s: any) => s.sync_key === "orders_v2");
  
  const lastSyncedAt = ordersSync ? ordersSync.last_synced_at : null;
  const notes = ordersSync ? ordersSync.notes : null;
  const updatedAt = ordersSync ? ordersSync.updated_at : null;

  return (
    <BackupClient 
      lastSyncedAt={lastSyncedAt} 
      notes={notes}
      updatedAt={updatedAt}
    />
  );
}
