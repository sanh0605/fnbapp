import { describeCancelBlocker, type CancelCheck } from "@/lib/purchasing/purchase-order-cancel";

// Read-only helpers of scripts/check-purchase-order-cancel.ts: argument parsing
// and output text. No database access here.

const moneyFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function parseCheckArgs(argv: string[]): { ok: true; ids: string[] } | { ok: false; error: string } {
  const flag = argv.find(arg => arg.startsWith("-"));
  if (flag) return { ok: false, error: `Không có tuỳ chọn ${flag}: script này chỉ đọc, không ghi gì.` };
  if (argv.length === 0) return { ok: false, error: "Cần ít nhất một mã phiếu, ví dụ: PO-147 PO-064" };
  return { ok: true, ids: argv };
}

export function formatCancelCheck(id: string, check: CancelCheck): string {
  if (check.blocked.length > 0) {
    return [`${id}: không huỷ được`, ...check.blocked.map(b => `  ${describeCancelBlocker(b)}`)].join("\n");
  }
  return [
    `${id}: huỷ được`,
    ...check.assets.map(
      a => `  tài sản sẽ ngừng: ${a.id} ${a.name}, SL ${quantityFormat.format(a.quantity)}, ${moneyFormat.format(a.totalCost)}đ`,
    ),
  ].join("\n");
}

export function summariseChecks(checks: CancelCheck[]): string {
  const cancellable = checks.filter(c => c.blocked.length === 0).length;
  return `${checks.length} phiếu đã kiểm: ${cancellable} huỷ được, ${checks.length - cancellable} không huỷ được.`;
}

export async function runChecks(
  ids: string[],
  fetchCheck: (id: string) => Promise<CancelCheck>,
): Promise<{ text: string; checks: CancelCheck[] }> {
  const checks: CancelCheck[] = [];
  const blocks: string[] = [];
  for (const id of ids) {
    const check = await fetchCheck(id);
    checks.push(check);
    blocks.push(formatCancelCheck(id, check));
  }
  return { text: [...blocks, "", summariseChecks(checks)].join("\n"), checks };
}
