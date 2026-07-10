# Antigravity Prompt — Sidebar Reorg + Accordion UX (Task U1)

Date: 2026-07-10
Owner: Antigravity (UI Lead)
Status: Prompt ready — pick up after Claude's cleanup commit lands.

## Background

Current sidebar (`app/admin/layout.tsx`) has structural issues:

1. **Group "Nguyên vật liệu" mixes concerns** — Suppliers (counterparty) + Categories (classification) + Items (catalog) + Conversions/Units (config) + Sync (operation). 4 different concern types in 1 group.
2. **Group "Hệ thống" grab-bag** — Users (admin) + Backdate/Activity Log (audit) + Cache/Backup (utility). 3 different purposes.
3. **Single-item groups** — "Tổng quan", "Thương hiệu" don't need their own groups.
4. **Label jargon** — "Bán thành phẩm", "COGS", "Backdate" hard to understand for Vietnamese users.
5. **No accordion** — multiple groups can be expanded simultaneously. Total height can exceed viewport, causing ugly scrollbar that distorts layout.

User approved Option B reorg + accordion behavior + thin scrollbar safety net.

## Goal

Implement 2 changes in one commit:

1. **Reorg nav structure** to workflow-based grouping with clear Vietnamese labels
2. **Accordion behavior** — only 1 group expanded at a time, auto-expand active group on navigation, custom thin scrollbar as safety net

## Files

| File | Action | Purpose |
|---|---|---|
| `app/admin/layout.tsx` | Modify | Nav structure + accordion state logic |
| `app/globals.css` (or equivalent) | Modify | Add thin scrollbar CSS class for nav |

## Spec 1: New nav structure

Replace current `navItems` array (lines 13-84) with this structure:

```ts
const navItems = [
  { name: "Tổng quan", href: "/admin", icon: "📊" },
  {
    name: "Danh mục",
    icon: "📦",
    children: [
      { name: "Thương hiệu", href: "/admin/brands" },
      { name: "Nhà cung cấp", href: "/admin/suppliers" },
      { name: "Phân loại Hàng", href: "/admin/inventory/categories" },
      { name: "Nhóm Nguyên Liệu", href: "/admin/inventory/base-ingredients" },
      { name: "Hàng Mua Vào", href: "/admin/inventory/items" },
      { name: "Bảng Quy Đổi", href: "/admin/inventory/conversions" },
      { name: "Quản lý Đơn vị", href: "/admin/inventory/units" },
    ]
  },
  {
    name: "Nhập hàng & Tồn kho",
    icon: "🚚",
    children: [
      { name: "Đơn Nhập Hàng", href: "/admin/inventory/purchase-orders" },
      { name: "Điều chỉnh Tồn kho", href: "/admin/inventory/stock-adjustments" },
      { name: "Đồng bộ Tồn kho", href: "/admin/inventory/sync" },
      { name: "Nhập hàng chờ duyệt", href: "/admin/audit/backdated-ledger" },
    ]
  },
  {
    name: "Sản xuất",
    icon: "🥣",
    children: [
      { name: "Công thức Bán thành phẩm", href: "/admin/semi-products" },
      { name: "Sản xuất / Nấu Bếp", href: "/admin/production" },
    ]
  },
  {
    name: "Menu Bán hàng",
    icon: "☕",
    children: [
      { name: "Danh mục Nhóm", href: "/admin/products/categories" },
      { name: "Danh sách Món", href: "/admin/products" },
      { name: "Topping & Tùy chọn", href: "/admin/products/modifiers" },
      { name: "Topping Độc Lập", href: "/admin/products/toppings" },
      { name: "Dự toán Giá vốn", href: "/admin/products/cogs-estimate" },
    ]
  },
  {
    name: "Bán hàng",
    icon: "🧾",
    children: [
      { name: "Đơn hàng", href: "/admin/orders" },
      { name: "Khuyến mãi", href: "/admin/promotions" },
    ]
  },
  {
    name: "Báo cáo",
    icon: "📈",
    children: [
      { name: "Báo cáo Bán hàng", href: "/admin/reports/sales" },
      { name: "Báo cáo Lãi lỗ", href: "/admin/reports/pnl" },
      { name: "Báo cáo Tồn kho", href: "/admin/reports/stock" },
    ]
  },
  {
    name: "Hệ thống",
    icon: "⚙️",
    children: [
      { name: "Nhân sự & Phân quyền", href: "/admin/users" },
      { name: "Nhật ký Hoạt động", href: "/admin/activity-log" },
      { name: "Sao lưu & Đồng bộ", href: "/admin/backup" },
      { name: "Xoá Cache", href: "/admin/clear-cache" },
    ]
  }
];
```

**Key changes vs current:**
- "Thương hiệu" folded into "Danh mục" group
- "Nguyên vật liệu" group renamed to "Danh mục" (broader catalog scope)
- "Đồng bộ Tồn kho" moved from Danh mục → "Nhập hàng & Tồn kho" (it's an operation)
- "Backdate Cần Duyệt" renamed to "Nhập hàng chờ duyệt" + moved from "Hệ thống" → "Nhập hàng & Tồn kho" (it's part of PO workflow)
- "Bán thành phẩm" renamed to "Sản xuất" (clearer)
- "Thành phẩm (Menu)" renamed to "Menu Bán hàng" (no English mix)
- "Công cụ Dự toán COGS" renamed to "Dự toán Giá vốn" (Vietnamese, no jargon)
- "Hệ thống" group slimmed from 5 → 4 items (backdate moved out)

## Spec 2: Accordion behavior

Replace current `expandedGroups` state (Record<string, boolean>) with single-group state:

### Current (line 148):
```ts
const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
  "Nguyên vật liệu": pathname.includes("/admin/inventory") && !pathname.includes("/purchase-orders"),
  "Nhập hàng & Tồn kho": pathname.includes("/admin/inventory/purchase-orders") || pathname.includes("/admin/inventory/stock-adjustments"),
  "Bán thành phẩm": pathname.includes("/admin/semi-products") || pathname.includes("/admin/production"),
  ...
});
```

### New:
```ts
const [openGroup, setOpenGroup] = useState<string | null>(() => {
  // Auto-expand the group containing the active route on initial load
  for (const item of navItems) {
    if (item.children?.some((child: any) => pathname === child.href)) {
      return item.name;
    }
  }
  return null;
});

// Auto-expand on navigation
useEffect(() => {
  for (const item of navItems) {
    if (item.children?.some((child: any) => pathname === child.href)) {
      setOpenGroup(item.name);
      return;
    }
  }
}, [pathname]);

const toggleGroup = (name: string) => {
  setOpenGroup(prev => prev === name ? null : name);
};
```

### Update onClick handler in render:

Find existing group toggle handler (likely calls `setExpandedGroups` with spread) and replace with:

```tsx
onClick={() => toggleGroup(item.name)}
```

### Update isExpanded check:

```tsx
// Old
const isExpanded = !!expandedGroups[item.name];

// New
const isExpanded = openGroup === item.name;
```

## Spec 3: Thin scrollbar safety net

Add custom CSS class to sidebar nav. Even with accordion, viewport edge cases (very small browser window) could trigger overflow — style it cleanly.

### In `app/globals.css` (or wherever global styles live):

```css
.sidebar-nav-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
}

.sidebar-nav-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.15);
  border-radius: 2px;
}

.sidebar-nav-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}
```

### Apply to nav element (line 225):

```tsx
// Old
<nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">

// New
<nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-nav-scroll">
```

## Out of scope (do NOT do)

- Do NOT change mobile drawer behavior (`isSidebarOpen` logic unchanged)
- Do NOT change top header / POS modal logic
- Do NOT add new pages or routes (only restructure existing)
- Do NOT change route paths (only labels and grouping)
- Do NOT touch unrelated dirty files in working tree (`supabase/.temp/cli-latest`, scripts/debug-*.ts, etc.)
- Do NOT add icon library (emoji icons remain as-is)
- Do NOT remove the `Topping Độc Lập` link (separate cleanup task if needed)
- Do NOT change authentication / session logic

## Verification

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → 335/335 pass
- Manual via Playwright (or browser):
  1. Navigate `/admin` → "Tổng quan" highlighted, no group expanded
  2. Click "Danh mục" → expands, others collapse
  3. Click "Danh mục" again → collapses
  4. Click "Hàng Mua Vào" → "Danh mục" auto-expands, navigates
  5. From "/admin/inventory/items", navigate to "/admin/orders" → "Danh mục" auto-collapses, "Bán hàng" auto-expands
  6. Resize browser to short height (e.g., 600px) → thin scrollbar appears, doesn't distort layout
  7. Mobile (DevTools toggle) → drawer opens, accordion works inside drawer

## Commit

Single commit:
```
Antigravity feat: sidebar workflow reorg + accordion UX (Task U1)
```

Commit body should document:
- New group structure (8 groups, 28 items)
- Accordion behavior (single open group, auto-expand active)
- Thin scrollbar safety net CSS
- Labels changed (Bán thành phẩm → Sản xuất, etc.)
- Backdate page moved to "Nhập hàng & Tồn kho" group with label "Nhập hàng chờ duyệt"

## Coordination

- After this commit lands, U1 and U3 are both resolved (U3 was the label/group fix, now subsumed by U1 reorg)
- Claude will update ROADMAP.md to move U1 + U3 from P1/P2 to COMPLETED.md
- Next P1 items: E1 (Codex Task 1 modifier recipe), U2 (UI sweep)
- E1 is Codex scope, U2 is Antigravity scope → can run in parallel after this commit
- Per commit protocol: this commit lands first, then E1 + U2 may run parallel (different file scopes)

## If blocker encountered

Likely blockers:
- `expandedGroups` referenced elsewhere (search for it before changing): if yes, update all references to use `openGroup`
- Existing route assumptions break (e.g., active link highlighting): test all 28 nav items manually
- `useEffect` import missing at top of file: add to existing react import

If blocked, document with `WIP - blocked:` prefix and pause.
