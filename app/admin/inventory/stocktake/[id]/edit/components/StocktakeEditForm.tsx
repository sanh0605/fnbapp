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
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { useStocktakeLinesFilter } from "@/app/admin/inventory/stocktake/[id]/components/useStocktakeLinesFilter";


export function StocktakeEditForm({ detail }: { detail: Detail }) {
  const router = useRouter();
  const savingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(detail.lines.map((l) => [l.id, l.countedQty])),
  );

  const lines = detail.lines.map((l) => {
    const counted = values[l.id] ?? null;
    const state = counted === null ? "BLANK" as const : counted === l.theoreticalAtCount ? "MATCH" as const : "OFF" as const;
    return { ...l, state };
  });
  const { activeTab, setActiveTab, searchQuery, setSearchQuery, allCount, blankCount, offCount, matchCount, hasBlank, filteredLines } =
    useStocktakeLinesFilter(lines);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;

    setError(null);

    const cleared = detail.lines.find((l) => l.countedQty !== null && values[l.id] === null);
    if (cleared) {
      // Show the emptied line (a chip or search may hide it), put the cursor in its box and mark it.
      setActiveTab("BLANK");
      setSearchQuery("");
      setError(`"${cleared.itemName}" chưa có số đếm. Nhập số vào ô của dòng này rồi lưu lại.`);
      setTimeout(() => {
        const el = document.getElementById(`line-${cleared.id}`) as HTMLInputElement | null;
        el?.focus();
        el?.reportValidity();
      });
      return;
    }

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
    // Filters sit outside the form: typing a search is not an unsaved change for the save bar.
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 pt-2">
        {[
          { id: "ALL" as const, label: "Tất cả", count: allCount, show: true },
          { id: "BLANK" as const, label: "Chưa đếm", count: blankCount, show: hasBlank || activeTab === "BLANK" },
          { id: "OFF" as const, label: "Lệch", count: offCount, show: true },
          { id: "MATCH" as const, label: "Khớp", count: matchCount, show: true },
        ]
          .filter((tab) => tab.show)
          .map((tab) => {
            // Same chips as the session page (StocktakeDetailView)
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3 min-h-[48px] md:min-h-[40px] text-xs md:text-sm font-medium border ${
                  active
                    ? "bg-primary-soft text-primary border-primary/20"
                    : "bg-surface-card text-text-primary border-border"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
      </div>

      {/* Search box */}
      <div className="max-w-md">
        <Field label="Tìm hàng" htmlFor="stocktake-edit-search">
          <TextInput
            id="stocktake-edit-search"
            placeholder="Ví dụ: Bột cà phê"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Field>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Rows */}
        {filteredLines.length === 0 ? (
          <div className="p-8 text-center text-text-muted bg-surface-card rounded-2xl border border-border">
            Không có mặt hàng nào phù hợp bộ lọc
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLines.map((line) => {
              const val = values[line.id] ?? null;
              const varianceText = getVarianceText(val, line.theoreticalAtCount, line.unitName);

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

                  <div className="w-36 md:w-full shrink-0">
                    <NumberInput
                      id={`line-${line.id}`}
                      decimals={3}
                      min={0}
                      example="1.5" // the unit beside it leaves no room for "1,250.5" on a phone
                      required={line.countedQty !== null} // an uncounted line may stay uncounted (BR-INV-011)
                      unit={line.unitName}
                      aria-label={line.itemName}
                      value={val}
                      onValueChange={(newVal) => {
                        setError(null);
                        setValues((prev) => ({ ...prev, [line.id]: newVal }));
                      }}
                    />
                  </div>

                  <div className="hidden md:block text-sm text-text-secondary md:text-right tabular-nums">
                    {varianceText}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        <FormActionBar
          mode="edit"
          loading={loading}
          onCancel={() => router.push(`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`)}
        />
      </form>
    </div>
  );
}
