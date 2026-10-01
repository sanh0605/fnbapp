// Pages under app/admin with no nav entry, each with a one-line reason.
// Checked by app/admin/nav-guard.test.ts: a route with a page but no
// navItems entry and no allowlist entry fails that test.
//
// section 3.
// Measured 2026-08-25. The two TODO entries below are pre-existing, not new
// regressions -- deliberately left unlinked rather than quietly wired into
// the menu, because linking a possibly-dead screen is worse than leaving it
// unreachable. Owner decision needed on each. (A third, /admin/reports/stock,
// was here too -- removed 2026-08-31 when the screen itself was deleted,
// Phase A.)
import type { AllowlistEntry } from "@/lib/shared/nav-completeness";

export const NAV_ALLOWLIST: AllowlistEntry[] = [
  {
    route: "/admin/inventory",
    reason: "section index, reached as a parent -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/purchase-orders/new",
    reason: "reached from the purchase-orders list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/issue-slips/new",
    reason: "reached from the issue-slips list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/items/new",
    reason: "reached from the items list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/categories/new",
    reason: "reached from the categories list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/units/new",
    reason: "reached from the units list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/conversions/new",
    reason: "reached from the conversions list -- legitimately unlinked",
  },
  {
    route: "/admin/inventory/asset-bands/new",
    reason: "reached from the asset-bands list -- legitimately unlinked",
  },
  {
    route: "/admin/suppliers/new",
    reason: "reached from the suppliers list -- legitimately unlinked",
  },
  {
    route: "/admin/finance/new",
    reason: "reached from the finance list -- legitimately unlinked",
  },
  {
    route: "/admin/finance/categories/new",
    reason: "reached from the categories list -- legitimately unlinked",
  },
  {
    route: "/admin/finance/bank-accounts/new",
    reason: "reached from the bank-accounts list -- legitimately unlinked",
  },
  {
    route: "/admin/pos-sync",
    reason:
      "reached from the Tổng quan page (app/admin/page.tsx links it)",
  },
  {
    route: "/admin/products/toppings",
    reason:
      "TODO: owner decision -- confirmed dead as its own screen: the entire page body is redirect(\"/admin/products/modifiers\")",
  },
  {
    route: "/admin/clear-cache",
    reason:
      "left the menu 2026-09-29 (spec 2026-09-29-menu-va-khuon-trang-design.md section 2): saves already refresh cached data; kept as a fallback by URL",
  },
  {
    route: "/admin/inventory/conversions",
    reason:
      "left the menu 2026-09-29 (same spec, section 2): opened from the \"Bảng quy đổi\" button on the Hàng hoá page",
  },
];
