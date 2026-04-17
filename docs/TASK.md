# TASK MANAGEMENT

## TASK-001: IndexedDB Setup

### Goal
Implement local database for offline-first POS.

---

### Requirements

1. Create IndexedDB database:
   - name: fnb_db

2. Create object stores:

- pending_orders
  - key: client_id
  - fields:
    - client_id (UUID)
    - payload (order data)
    - created_at
    - retries

- cached_menu
  - key: id
  - store products/menu for offline use

---

### Functions Required

- initDB()
- addPendingOrder(order)
- getPendingOrders()
- removePendingOrder(client_id)
- incrementRetry(client_id)

---

### Constraints

- Must follow ARCHITECTURE.md
- Must support offline-first
- Must be reusable (used by POS module)

---

### Output

- Code only
- No explanation