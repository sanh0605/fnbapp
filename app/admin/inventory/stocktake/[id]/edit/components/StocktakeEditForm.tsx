"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatNumber } from "@/lib/shared/format";
import {
  editConfirmedStocktake,
  type StocktakeDetailView as Detail,
} from "@/app/admin/inventory/stocktake/actions";
import { getVarianceText } from "@/app/admin/inventory/stocktake/[id]/components/StocktakeDetailView";
import { FormActionBar } from "@/components/ui/FormActionBar";


export function StocktakeEditForm({ detail }: { detail: Detail }) {
  const router = useRouter();
  const savingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(detail.lines.map((l) => [l.id, l.countedQty])),
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;

    setError(null);

    const changed: Array<{ lineId: string; countedQty: number }> = [];
    for (const line of detail.lines) {
      const val = values[line.id];
      if (val !== null && val !== undefined && val !== line.countedQty) {
        changed.push({ lineId: line.id, countedQty: val });
      }
    }

    if (changed.length === 0) {
      router.push(`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`);
      return;
    }

    savingRef.current = true;
    setLoading(true);

    try {
      const res = await editConfirmedStocktake(detail.id, changed);
      if (res?.error) {
        setError(res.error);
        savingRef.current = false;
        setLoading(false);
        return;
      }
      router.push(`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`);
      router.refresh();
    } catch {
      setError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
      savingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-3">
        {detail.lines.map((line) => {
          const val = values[line.id] ?? null;
          const varianceText = getVarianceText(val, line.theoreticalAtCount);

          return (
            <div
              key={line.id}
              data-line-id={line.id}
              className="bg-surface-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3 md:grid md:grid-cols-[1fr_200px_160px] md:items-center md:gap-6"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-text-primary">
                  {line.itemName}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Sổ lúc đếm{" "}
                  {line.theoreticalAtCount !== null
                    ? formatNumber(line.theoreticalAtCount)
                    : "—"}
                  {line.unitName ? ` ${line.unitName}` : ""}
                </div>
                <div className="text-xs text-text-secondary tabular-nums md:hidden mt-0.5">
                  {varianceText}
                </div>
              </div>

              <div className="w-28 md:w-full shrink-0">
                <NumberInput
                  id={`line-${line.id}`}
                  decimals={3}
                  min={0}
                  required={line.countedQty !== null} // an uncounted line may stay uncounted (BR-INV-011)
                  unit={line.unitName}
                  aria-label={line.itemName}
                  value={val}
                  onValueChange={(newVal) =>
                    setValues((prev) => ({ ...prev, [line.id]: newVal }))
                  }
                />
              </div>

              <div className="hidden md:block text-sm text-text-secondary md:text-right tabular-nums">
                {varianceText}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      <FormActionBar
        mode="edit"
        loading={loading}
        onCancel={() => router.push(`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`)}
      />
    </form>
  );
}
