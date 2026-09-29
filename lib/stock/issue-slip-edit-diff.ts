// Turns an edited slip draft into the lines to return to stock and the lines
// to raise anew. A changed quantity is a return plus a new line, never an in-place edit;
// its return is dated on the slip's own date (replaceIssueIds), a pure delete is dated now (removeIssueIds).
export interface EditOriginalLine { issueId: string; purchasedItemId: string; baseQuantity: number }
export interface EditDraftLine { issueId: string | null; purchasedItemId: string; baseQuantity: number; removed: boolean }
export type EditDiff =
  | { ok: true; removeIssueIds: string[]; replaceIssueIds: string[]; addLines: { purchasedItemId: string; baseQuantity: number }[] }
  | { ok: false; error: string };

const EPSILON = 1e-9;

export function diffIssueSlipEdit(original: EditOriginalLine[], draft: EditDraftLine[]): EditDiff {
  const originalById = new Map(original.map(l => [l.issueId, l]));
  if (draft.some(d => d.issueId !== null && !originalById.has(d.issueId))) {
    return { ok: false, error: "Dòng không thuộc phiếu này. Tải lại trang rồi sửa lại." };
  }

  const removeIssueIds: string[] = [];
  const replaceIssueIds: string[] = [];
  const addLines: { purchasedItemId: string; baseQuantity: number }[] = [];
  let remaining = 0;

  for (let i = 0; i < draft.length; i++) {
    const d = draft[i];
    const isNew = d.issueId === null;
    if (isNew && (!d.purchasedItemId || d.removed)) continue;
    if (!d.removed && (!Number.isFinite(d.baseQuantity) || d.baseQuantity <= 0)) {
      return { ok: false, error: `Dòng ${i + 1}: số lượng phải lớn hơn 0` };
    }
    if (d.issueId === null) {
      addLines.push({ purchasedItemId: d.purchasedItemId, baseQuantity: d.baseQuantity });
      remaining++;
      continue;
    }
    const orig = originalById.get(d.issueId)!;
    if (d.removed) {
      removeIssueIds.push(orig.issueId);
      continue;
    }
    remaining++;
    if (Math.abs(d.baseQuantity - orig.baseQuantity) > EPSILON) {
      replaceIssueIds.push(orig.issueId);
      addLines.push({ purchasedItemId: orig.purchasedItemId, baseQuantity: d.baseQuantity });
    }
  }

  if (remaining === 0) return { ok: false, error: "Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết." };
  if (removeIssueIds.length === 0 && replaceIssueIds.length === 0 && addLines.length === 0) return { ok: false, error: "Chưa có thay đổi nào." };
  return { ok: true, removeIssueIds, replaceIssueIds, addLines };
}
