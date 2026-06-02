# Phin Đi - System Architecture (The Building Blueprint)
# Last Updated: 2026-04-29

## 1. THE ARCHITECTURE ANALOGY
| Technical Part | Business Analogy | Clear Definition |
| :--- | :--- | :--- |
| **Next.js** | **The Main Building** | The framework that manages pages and security checks. |
| **Supabase** | **The Master Ledger** | The database where we store orders, inventory, and staff IDs. |
| **Tailwind & shadcn** | **Interior Design** | The visual style that ensures a consistent Vietnamese UI. |
| **React Query** | **The Waiter's Memory** | Automatically updates the UI when data changes in the Ledger. |
| **IndexedDB** | **The Emergency Pad** | Stores pending orders on the phone's hardware when offline. |

---

## 2. THE THREE CORE ENGINES

### A. The "Standard Manual" (Domain Logic)
- **What it is:** A single file (`lib/domain/orders.ts`) that holds every price rule.
- **Why it matters:** If you change the price of "Cà phê muối" in this manual, the POS and the Revenue Reports update simultaneously. **No manual math allowed.**

### B. The "Delivery Runner" (Sync Engine)
- **What it is:** A background process that checks for internet every 30 seconds.
- **Process:** Order created -> Save to "Emergency Pad" (Local) -> If online, send to "Master Ledger" (Cloud) -> If success, delete from "Emergency Pad."

### C. The "Security Gate" (Roles & Permissions)
We have three specific "Keys" for the building:
1. **Owner Key (You):** Access to all Brands, all financial charts, and the ability to "Hire/Fire" users in the system.
2. **Manager Key:** Access to reports and staff settings for **one specific brand only** (e.g., only Trà Tối).
3. **Staff Key:** Access to the POS screen and personal profile ONLY. Cannot see revenue reports.

---

## 3. SECURITY & IDEMPOTENCY (No Double Counting)
- Every order taken at the stall is assigned a **UUID** (Unique Universal ID). 
- If a staff member hits "Confirm" twice, the Master Ledger sees the same UUID and says: "I already have this sale, I won't count it again."
- This is the absolute defense against double-counting revenue.
