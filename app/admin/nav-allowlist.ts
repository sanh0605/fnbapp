// Pages under app/admin with no nav entry, each with a one-line reason.
// Checked by app/admin/nav-guard.test.ts: a route with a page but no
// navItems entry and no allowlist entry fails that test.
//
// docs/superpowers/plans/2026-08-25-outlet-screen-and-nav-guard.md section 3.
// Measured 2026-08-25. The last three are pre-existing, not new
// regressions -- deliberately left unlinked rather than quietly wired into
// the menu, because linking a possibly-dead screen is worse than leaving it
// unreachable. Owner decision needed on each.
import type { AllowlistEntry } from "@/lib/nav-completeness";

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
    route: "/admin/pos-sync",
    reason:
      "TODO: owner decision -- a real, working screen (\"Đơn cần chú ý\": late orders + sync failures via getPosSyncAttentionItems), just never linked; looks like a plain oversight, not a dead page",
  },
  {
    route: "/admin/products/toppings",
    reason:
      "TODO: owner decision -- confirmed dead as its own screen: the entire page body is redirect(\"/admin/products/modifiers\")",
  },
  {
    route: "/admin/reports/stock",
    reason:
      "TODO: owner decision -- superseded by \"Giá trị hàng đã xuất\" (/admin/reports/issued) per layout.tsx's own 2026-08-13 comment; kept on disk on purpose, not deleted",
  },
];
