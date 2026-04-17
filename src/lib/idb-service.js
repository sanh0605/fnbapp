/**
 * src/lib/idb-service.js
 * IndexedDB Service for Offline-First POS
 */

const IDBService = (() => {
  const DB_NAME = 'fnb_db';
  const DB_VERSION = 1;
  const STORE_PENDING = 'pending_orders';
  const STORE_MENU = 'cached_menu';
  const MAX_RETRIES = 5;

  let dbPromise = null;

  /**
   * Initializes the IndexedDB database and object stores.
   * Ensures single connection using a promise.
   * @returns {Promise<IDBDatabase>}
   */
  function initDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          db.createObjectStore(STORE_PENDING, { keyPath: 'local_id' });
        }
        if (!db.objectStoreNames.contains(STORE_MENU)) {
          db.createObjectStore(STORE_MENU, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        dbPromise = null; // Allow retry on error
        reject(event.target.error);
      };
    });

    return dbPromise;
  }

  /**
   * Adds an order to the pending queue.
   * Ensures client_id is present in both keyPath and payload.
   * @param {Object} order 
   * @returns {Promise<void>}
   */
  async function addPendingOrder(order) {
    const db = await initDB();
    
    // Ensure client_id exists and is in payload
    if (!order.client_id) {
      order.client_id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Date.now().toString() + Math.random().toString(36).substring(2);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PENDING], 'readwrite');
      const store = transaction.objectStore(STORE_PENDING);
      
      const entry = {
        local_id: order.client_id,
        payload: order,
        created_at: new Date().toISOString(),
        retries: 0
      };

      const request = store.add(entry);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Retrieves all pending orders from the queue.
   * @returns {Promise<Array>}
   */
  async function getPendingOrders() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PENDING], 'readonly');
      const store = transaction.objectStore(STORE_PENDING);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Removes a pending order by its local_id.
   * @param {string} local_id 
   * @returns {Promise<void>}
   */
  async function removePendingOrder(local_id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PENDING], 'readwrite');
      const store = transaction.objectStore(STORE_PENDING);
      const request = store.delete(local_id);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Increments the retry count for a pending order.
   * @param {string} local_id 
   * @returns {Promise<void>}
   */
  async function incrementRetry(local_id) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PENDING], 'readwrite');
      const store = transaction.objectStore(STORE_PENDING);
      const getRequest = store.get(local_id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.retries = (data.retries || 0) + 1;
          const putRequest = store.put(data);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = (event) => reject(event.target.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Checks if an entry has exceeded the retry limit.
   * @param {Object} entry
   * @returns {boolean}
   */
  function isDeadLetter(entry) {
    return (entry.retries || 0) >= MAX_RETRIES;
  }

  /**
   * Replace the entire menu cache with fresh products.
   * Call after a successful online fetch so offline sessions can use it.
   * @param {Array} products  Array of product objects (must have .id)
   * @returns {Promise<void>}
   */
  async function cacheMenu(products) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MENU], 'readwrite');
      const store = transaction.objectStore(STORE_MENU);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (!products.length) { resolve(); return; }
        let pending = products.length;
        products.forEach(product => {
          const req = store.put(product);
          req.onsuccess = () => { if (--pending === 0) resolve(); };
          req.onerror  = (e) => reject(e.target.error);
        });
      };
      clearReq.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all cached products (used when offline).
   * Returns empty array if cache is empty.
   * @returns {Promise<Array>}
   */
  async function getMenu() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_MENU], 'readonly');
      const store = transaction.objectStore(STORE_MENU);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror  = (e) => reject(e.target.error);
    });
  }

  return {
    MAX_RETRIES,
    initDB,
    addPendingOrder,
    getPendingOrders,
    removePendingOrder,
    incrementRetry,
    isDeadLetter,
    cacheMenu,
    getMenu,
  };
})();
