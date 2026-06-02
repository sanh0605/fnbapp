# Phin Đi - Business Context & Vision
# Last Updated: 2026-04-29

## 1. THE BUSINESS VISION
We are transforming "Phin Đi" from a street-side coffee stall into a professional F&B building.
- **The Stall (Old):** Manual calculations, risk of errors, no central "brain."
- **The Building (New):** Automated logic, data-driven decisions, professional security.

---

## 2. SUCCESS METRICS (How we know we won)
To remove ambiguity, we define "Success" as follows:
1. **Financial Precision:** 100% of orders in the new system must match the calculations in the old system (down to the last 1.000 đ).
2. **Zero Downtime:** Staff must be able to take an order within 3 seconds, even if the internet is completely disconnected.
3. **Data Integrity:** No existing sale from the last year is lost or altered during the move.
4. **Professionalism:** The UI must be fully in Vietnamese and look like a premium app (not a side project).

---

## 3. THE "GOLDEN RULES"
1. **SIDE-BY-SIDE BUILD:** We work in a folder named `v2`. We NEVER delete or modify the `src` folder (the old stall) until the building is finished.
2. **LEDGER IS SACRED:** All sales are written to the existing Supabase "Ledger." We do not create a new database; we simply put a better "Lock" on the existing one.
3. **TECH SIMPLICITY:** We use Next.js for the building structure and Tailwind/shadcn for the furniture. No other libraries are allowed without Owner approval.

---

## 4. CURRENT PORTFOLIO
| Brand | Code | Outlets |
|---|---|---|
| Cà Phê Sáng | `CF_SANG` | 5 Locations (CF_O1 to CF_O5) |
| Trà Tối | `TRA_TOI` | 2 Locations (TRA_O1 to TRA_O2) |
