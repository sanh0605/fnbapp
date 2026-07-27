/**
 * Browser-only local queue for POS orders that could not be submitted
 * immediately (offline or a network failure at submission time). Storage
 * only -- retry orchestration lives in components/POSScreen.tsx, since it
 * needs component-scoped state (toasts, draft refresh) the storage layer
 * has no business knowing about.
 */

import type { CartInput } from "@/lib/order-cart";

const DB_NAME = "pos-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending_orders";

export interface PendingOrderRecord {
  requestToken: string;
  cartInput: CartInput;
  queuedAt: string;
  attemptCount: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "requestToken" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueuePendingOrder(record: PendingOrderRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listPendingOrders(): Promise<PendingOrderRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const records = (request.result as PendingOrderRecord[]).slice();
      records.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
      resolve(records);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingOrder(requestToken: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(requestToken);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementAttemptCount(requestToken: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(requestToken);
    getRequest.onsuccess = () => {
      const record = getRequest.result as PendingOrderRecord | undefined;
      if (record) {
        record.attemptCount += 1;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
