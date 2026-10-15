"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatNumber } from "@/lib/shared/format";
import {
  editConfirmedStocktake,
  type StocktakeDetailView as Detail,
} from "@/app/admin/inventory/stocktake/actions";
import { getVarianceText } from "@/app/admin/inventory/stocktake/[id]/components/StocktakeDetailView";


export function StocktakeEditForm({ detail }: { detail: Detail }): JSX.Element {
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
              className="bg-surface-card rounded-2xl border border-border p-4 space-y-3 md:space-y-0 md:grid md:grid-cols-[1fr_200px_160px] md:items-center md:gap-6"
            >
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {line.itemName}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Sổ lúc đếm{" "}
                  {line.theoreticalAtCount !== null
                    ? formatNumber(line.theoreticalAtCount)
                    : "—"}
                </div>
              </div>

              <div>
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

              <div className="text-sm text-text-secondary md:text-right tabular-nums">
                {varianceText}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="danger">{error}</Alert>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
        <Button
          href={`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Bỏ
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full sm:w-auto"
        >
          Lưu
        </Button>
      </div>
    </form>
  );
}
