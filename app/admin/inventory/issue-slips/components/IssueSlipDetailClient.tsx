"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { normalizeNumberText, numberTextToValue } from "@/lib/shared/money-digits";
import { initialUnitQuantity, toBaseQuantity, buildIssueUnitOptions } from "@/lib/stock/issue-unit-options";
import type { EditDraftLine } from "@/lib/stock/issue-slip-edit-diff";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import type { IssueSlipItemView } from "../actions";
import { editIssueSlip } from "../actions";
import { IssueSlipEditLines, type DraftLine } from "./IssueSlipEditLines";
import { IssueSlipViewLines } from "./IssueSlipViewLines";
import { IssueSlipDialogs } from "./IssueSlipDialogs";

interface IssueSlipDetailClientProps {
  detail: IssueSlipDetail;
  items: IssueSlipItemView[];
  returnTo?: string;
}

function formatInputQuantity(val: number): string {
  return String(Math.round(val * 1000) / 1000);
}

export default function IssueSlipDetailClient({
  detail,
  items,
  returnTo = "/admin/inventory/issue-slips",
}: IssueSlipDetailClientProps): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [nextNewId, setNextNewId] = useState(1);

  const itemOptions = items.map((i) => ({ id: i.id, label: i.name }));

  function startEdit() {
    const initialDraft: DraftLine[] = detail.lines.map((line) => {
      const initUnit = initialUnitQuantity(line.baseQuantity, line.unitOptions);
      return {
        id: `OLD-${line.issueId}`,
        issueId: line.issueId,
        purchasedItemId: line.purchasedItemId,
        name: line.name,
        unitKey: initUnit.key,
        quantityInput: formatInputQuantity(initUnit.quantity),
        baseQuantity: line.baseQuantity,
        removed: false,
        selected: false,
      };
    });
    setDraft(initialDraft);
    setMode("edit");
    setServerError(null);
  }

  function discard() {
    setMode("view");
    setDraft([]);
    setServerError(null);
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setDraft((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function toggleAll() {
    const visibleLines = draft.filter((l) => !l.removed);
    const allSelected = visibleLines.length > 0 && visibleLines.every((l) => l.selected);
    setDraft((prev) => prev.map((l) => (!l.removed ? { ...l, selected: !allSelected } : l)));
  }

  function deleteSelected() {
    const next = draft.map((l) => (l.selected ? { ...l, removed: true, selected: false } : l));
    setDraft(next);
    if (next.filter((l) => !l.removed && (l.issueId !== null || l.purchasedItemId)).length === 0) {
      setShowEmptyDialog(true);
    }
  }

  function addLine() {
    const id = `NEW-${nextNewId}`;
    setNextNewId((prev) => prev + 1);
    setDraft((prev) => [
      ...prev,
      {
        id,
        issueId: null,
        purchasedItemId: "",
        name: "",
        unitKey: "",
        quantityInput: "",
        baseQuantity: 0,
        removed: false,
        selected: false,
      },
    ]);
  }

  function handleItemChange(id: string, purchasedItemId: string) {
    const item = items.find((i) => i.id === purchasedItemId);
    if (!item) {
      updateLine(id, {
        purchasedItemId: "",
        name: "",
        unitKey: "",
        quantityInput: "",
        baseQuantity: 0,
      });
      return;
    }
    const unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
    const firstOption = unitOptions[0];
    updateLine(id, {
      purchasedItemId: item.id,
      name: item.name,
      unitKey: firstOption.key,
      quantityInput: "1",
      baseQuantity: firstOption.factor,
    });
  }

  function handleUnitChange(id: string, unitKey: string) {
    setDraft((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      let unitOptions = detail.lines.find((l) => l.issueId === line.issueId)?.unitOptions;
      if (!unitOptions) {
        const item = items.find((i) => i.id === line.purchasedItemId);
        if (item) {
          unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
        }
      }
      if (!unitOptions) return prev;
      const option = unitOptions.find((o) => o.key === unitKey);
      if (!option) return prev;

      const newQty = line.baseQuantity / option.factor;
      return prev.map((l) =>
        l.id === id ? { ...l, unitKey, quantityInput: formatInputQuantity(newQty) } : l
      );
    });
  }

  function handleQtyChange(id: string, val: string) {
    const next = normalizeNumberText(val, 3);
    if (next === null) return;
    setDraft((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      let unitOptions = detail.lines.find((l) => l.issueId === line.issueId)?.unitOptions;
      if (!unitOptions) {
        const item = items.find((i) => i.id === line.purchasedItemId);
        if (item) {
          unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
        }
      }
      const option = unitOptions?.find((o) => o.key === line.unitKey);
      const parsedQty = numberTextToValue(next) ?? 0;

      return prev.map((l) =>
        l.id === id
          ? {
              ...l,
              quantityInput: next,
              baseQuantity: toBaseQuantity(parsedQty, option || { key: "", label: "", factor: 1, unitName: "" }),
            }
          : l
      );
    });
  }

  async function save() {
    const activeLines = draft.filter((l) => !l.removed && (l.issueId !== null || l.purchasedItemId));
    if (activeLines.length === 0) {
      setShowEmptyDialog(true);
      return;
    }

    const payload: EditDraftLine[] = draft.map((l) => ({
      issueId: l.issueId,
      purchasedItemId: l.purchasedItemId,
      baseQuantity: l.baseQuantity,
      removed: l.removed,
    }));

    setServerError(null);
    startTransition(async () => {
      const res = await editIssueSlip({ slipId: detail.id, draft: payload });
      if (res.error) {
        setServerError(res.error);
      } else {
        router.refresh();
        setMode("view");
        setDraft([]);
      }
    });
  }

  const visibleLines = draft.filter((l) => !l.removed);
  const selectedCount = visibleLines.filter((l) => l.selected).length;
  const allSelected = visibleLines.length > 0 && selectedCount === visibleLines.length;

  let changed = false;
  let exactDraftSum = 0;
  if (mode === "edit") {
    const realDraft = draft.filter((l) => l.issueId !== null || l.purchasedItemId);
    const originalMap = new Map(detail.lines.map((l) => [l.issueId, l.baseQuantity]));

    for (const d of realDraft) {
      if (d.issueId !== null) {
        if (d.removed || originalMap.get(d.issueId) !== d.baseQuantity) {
          changed = true;
        }
      } else if (!d.removed) {
        changed = true;
      }

      if (!d.removed && d.purchasedItemId) {
        const unitCost = detail.unitCostByItem?.[d.purchasedItemId];
        if (unitCost !== undefined) {
          exactDraftSum += unitCost * d.baseQuantity;
        }
      }
    }
  }
  const draftTotalValue = Math.round(exactDraftSum);

  const saveDisabled =
    visibleLines.filter((l) => l.issueId !== null || l.purchasedItemId).length === 0 || !changed;

  const cancelHref =
    returnTo !== "/admin/inventory/issue-slips"
      ? `/admin/inventory/issue-slips/${detail.id}/cancel?returnTo=${encodeURIComponent(returnTo)}`
      : `/admin/inventory/issue-slips/${detail.id}/cancel`;

  return (
    <div className="space-y-6 flex flex-col h-full bg-surface-background">
      <DetailHeader
        backHref={returnTo}
        backLabel="Phiếu xuất"
        title={detail.id}
        badge={
          <div className="flex items-center gap-2">
            {detail.cancellation && <Badge variant="neutral">Đã huỷ</Badge>}
            {mode === "edit" && <Badge variant="warning">Đang chỉnh sửa</Badge>}
          </div>
        }
        subtitle={
          <div className="space-y-1">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary">
              <span>
                Ngày xuất: <b className="text-text-primary font-medium">{detail.dateText}</b>
              </span>
              <span>
                Người ghi: <b className="text-text-primary font-medium">{detail.createdByName}</b>
              </span>
              {detail.note?.trim() ? (
                <span>
                  Lý do: <b className="text-text-primary font-medium">{detail.note.trim()}</b>
                </span>
              ) : null}
            </div>
            {detail.cancellation && detail.cancellation.reason && (
              <div className="text-sm text-text-secondary">
                Lý do huỷ: <b className="text-text-primary font-medium">{detail.cancellation.reason}</b>
              </div>
            )}
            {detail.cancellation && (
              <div className="text-sm text-text-secondary">
                Huỷ lúc {detail.cancellation.dateText}
              </div>
            )}
          </div>
        }
        actions={
          mode === "view" && detail.canEdit && !detail.cancellation ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={startEdit}>
                Chỉnh sửa
              </Button>
              <Button variant="delete" href={cancelHref}>
                Huỷ phiếu
              </Button>
            </div>
          ) : undefined
        }
      />

      {serverError && <Alert variant="danger">{serverError}</Alert>}

      {detail.lock && (
        <Alert variant="warning" className="max-w-lg">
          Phiếu nằm trước lần kiểm kê ngày {detail.lock.dateText} nên không sửa được. Sai lệch sẽ
          được bù ở lần kiểm kê sau.
        </Alert>
      )}

      {mode === "view" && <IssueSlipViewLines detail={detail} />}

      {mode === "edit" && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-text-secondary">
            Đổi số lượng: tính vào ngày của phiếu. Xoá dòng: trả hàng về kho vào ngày bấm lưu. Dòng
            mới: tính vào ngày của phiếu.
          </div>

          <IssueSlipEditLines
            draft={draft}
            items={items}
            itemOptions={itemOptions}
            detail={detail}
            allSelected={allSelected}
            draftTotalValue={draftTotalValue}
            toggleAll={toggleAll}
            updateLine={updateLine}
            handleItemChange={handleItemChange}
            handleUnitChange={handleUnitChange}
            handleQtyChange={handleQtyChange}
            addLine={addLine}
          />

          <div className="flex justify-end gap-2.5 mt-2">
            <Button variant="secondary" onClick={discard} disabled={isPending}>
              Bỏ thay đổi
            </Button>
            {selectedCount > 0 ? (
              <Button variant="delete" onClick={deleteSelected} disabled={isPending}>
                Xoá {selectedCount} dòng đã chọn
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={save}
                disabled={saveDisabled || isPending}
                loading={isPending}
              >
                Lưu thay đổi
              </Button>
            )}
          </div>
        </div>
      )}

      <IssueSlipDialogs
        isOpen={showEmptyDialog}
        cancelHref={cancelHref}
        onClose={() => setShowEmptyDialog(false)}
      />
    </div>
  );
}
