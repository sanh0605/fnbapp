import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-DATA-007 (owner 2026-09-30, narrowed 2026-10-01): an admin box with an
// input, or one only for viewing, becomes a page. Yes/no confirmations and
// error boxes stay (DeleteConfirmModal, confirm()/alert() in lib/shared/dialog).
// POS (app/pos) is exempt and not scanned.
//
// A file "opens a box" when it uses FormModal, ModalPortal, or draws its own
// full-screen overlay (`fixed inset-0`). Every such file under app/admin must
// be listed here with the reason it is allowed; a new one turns this red.
const ALLOWED: Record<string, string> = {
  "app/admin/layout.tsx":
    "the admin frame itself (fixed inset-0 shell) and the brand picker that opens the POS, which belongs to the exempt POS flow",
  "app/admin/components/MoreSheet.tsx": "phone menu sheet, navigation not an input box",
  "app/admin/inventory/components/InventoryForms.tsx": "ActionGroup asks yes/no before deleting",
  "app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx":
    "yes/no: cancel the slip when every line is removed, and cancel-slip confirmation (BR-INV-014)",
  "app/admin/orders/components/VoidOrderButton.tsx": "yes/no void confirmation with its mandatory reason",
};

const BOX_PATTERN = /\bFormModal\b|\bModalPortal\b|fixed inset-0/;

function adminSources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return adminSources(full);
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) return [];
    return [full];
  });
}

const root = process.cwd();
const files = adminSources(join(root, "app", "admin")).map(f => ({
  path: relative(root, f).split(sep).join("/"),
  src: readFileSync(f, "utf8"),
}));

describe("BR-DATA-007 no popups on admin screens", () => {
  it("only the listed yes/no, menu and POS boxes open over an admin page (chủ quán chốt 30/09 và 01/10/2026)", () => {
    const opening = files.filter(f => BOX_PATTERN.test(f.src)).map(f => f.path).sort();
    expect(opening).toEqual(Object.keys(ALLOWED).sort());
  });

  it("no admin screen uses the browser's own confirm or alert box", () => {
    const offenders = files.filter(f => /window\.(confirm|alert)\(/.test(f.src)).map(f => f.path);
    expect(offenders).toEqual([]);
  });
});
