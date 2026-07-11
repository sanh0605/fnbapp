# Design System Pre-Audit Findings

## Date
2026-07-11

## 1. Hardcoded Color Hex Values
Hardcoded hex colors are very rare across the codebase because Tailwind CSS is used extensively. The few instances found are:
- `components/CategoryPieChart.tsx`: Hardcoded array of hex colors matching Tailwind colors (`#3b82f6` for `blue-500`, `#10b981` for `emerald-500`, etc.) used for Chart.js.
- `app/admin/reports/sales/page.tsx`: Inline styles using `rgba(79, 70, 229, opacity)` and `#f9fafb` for dynamic cell backgrounds based on revenue.
- `app/manifest.ts`: `background_color` and `theme_color` set to `#ffffff`.

## 2. Duplicated Tailwind Colors (The Current "Theme")
Instead of hex codes, the application uses hardcoded Tailwind color classes extensively. These represent the "de facto" design system that needs to be tokenized:
- **Primary/Action**: `bg-blue-600`, `hover:bg-blue-700`, `text-blue-600`, `bg-blue-50`, `border-blue-200`, `text-blue-700` (used for buttons, active nav, highlights, icons).
- **Success**: `emerald-500`, `emerald-600`, `bg-emerald-50`, `text-emerald-700` (used for successful states, completed orders).
- **Error/Danger**: `red-500`, `red-600`, `bg-red-50`, `text-red-700`, `rose-50`, `rose-600` (used for voided orders, delete buttons, error messages).
- **Warning**: `amber-500`, `orange-500`, `bg-amber-50`, `text-amber-700` (used for reopened orders, manager tags).
- **Neutral/Surface**: `gray-50`, `gray-100`, `gray-200`, `gray-400`, `gray-500`, `gray-600`, `gray-900` (used for borders, backgrounds, text).

## 3. Emoji Icons Used
Emojis are currently used heavily for visual communication, especially in empty states, status badges, sidebars, and alerts.
- **Sidebar & Dashboard**: `📊` (Dashboard), `📦` (Inventory), `🚚` (Suppliers), `🥣` (Ingredients), `☕` (Menu/Products), `🧾` (Orders), `📈` (Reports), `⚙️` (Settings)
- **Status & Feedback**: `✔️` (Success), `⚠️` (Warning/Error), `💡` (Tip/Info)
- **Empty States**: `🕒` (Activity Log), `📋` (General list), `🛒` (Orders)
- **Others**: `🏢` (Brands)

## 4. Typography Patterns
Font size classes are heavily hardcoded into components rather than abstracted:
- `text-sm`: Used universally for table bodies, form labels, standard text.
- `text-xs`: Used for secondary information, dates, subtext, badges.
- `text-[11px]`: Highly specific custom utility used consistently for table headers (`text-[11px] uppercase tracking-wider font-bold text-gray-500`) and small ID tags.
- `text-[10px]`: Used for uppercase labels in filters and small tags.
- `font-bold` / `font-medium`: Used inline everywhere.

## 5. Inline Button Styles vs Shared Components
Currently, there is no shared `<Button>` component. Buttons are styled entirely via inline Tailwind classes. The dominant pattern is:
- **Primary Buttons (Add/Save)**: `className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"`
- **Secondary/Action Buttons (Edit/View)**: `className="text-blue-600 hover:text-blue-800 font-medium text-sm"`
- **Ghost/Small Actions**: `className="px-3 py-1.5 min-h-[44px] bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-xs rounded-lg transition"`
- **Danger Buttons (Delete)**: `className="text-red-600 hover:text-red-800 font-medium text-sm"`

## Conclusion & Next Steps
The UI is consistent in its *patterns*, but these patterns are completely hardcoded. Transitioning to the "Fresh Blue Admin" theme will require a mass find-and-replace of these specific Tailwind classes (`blue-600` -> `primary`, etc.) and the introduction of a central `<Button>` component to encapsulate the extremely repetitive inline button styles. The transition from Emojis to Lucide React icons will also drastically improve the professional feel of the application.
