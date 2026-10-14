"use client";

import React, { useMemo } from "react";
import { formatNumber } from "@/lib/shared/format";
import {
  canAddPortion,
  litOptionId,
  pickOne,
  type Pick,
  type ProductOptionGroup,
  type OptionRow,
} from "@/lib/sales/option-groups";

export interface OptionGroupPickerProps {
  groups: ProductOptionGroup[];
  picks: Pick[];
  onChange: (picks: Pick[]) => void;
}

export function OptionGroupPicker({ groups, picks, onChange }: OptionGroupPickerProps) {
  const allOptionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of groups) {
      for (const opt of g.options) {
        ids.add(opt.id);
      }
    }
    return ids;
  }, [groups]);

  const orphanPicks = useMemo(() => {
    return picks.filter((p) => !allOptionIds.has(p.id));
  }, [picks, allOptionIds]);

  const removeOrphanPick = (indexToRemove: number) => {
    const orphan = orphanPicks[indexToRemove];
    if (!orphan) return;
    const idx = picks.indexOf(orphan);
    if (idx !== -1) {
      const next = [...picks];
      next.splice(idx, 1);
      onChange(next);
    }
  };

  const removeManyPortion = (optionId: string) => {
    const idx = picks.findIndex((p) => p.id === optionId);
    if (idx !== -1) {
      const next = [...picks];
      next.splice(idx, 1);
      onChange(next);
    }
  };

  const addManyPortion = (g: ProductOptionGroup, option: OptionRow) => {
    if (!canAddPortion(picks, g, option)) return;
    onChange([...picks, { id: option.id, name: option.name, price: option.price }]);
  };

  if (groups.length === 0 && orphanPicks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const isOne = g.group.selection_mode === "ONE";
        const litId = isOne ? litOptionId(picks, g) : null;

        return (
          <div key={g.group.id}>
            <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">
              {g.group.name}
            </h4>

            {isOne ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {g.options.map((opt) => {
                  const isLit = litId === opt.id;
                  const priceNum = Number(opt.price);
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => onChange(pickOne(picks, g, opt))}
                      aria-pressed={isLit}
                      data-lit={isLit ? "true" : undefined}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-colors min-h-[44px] ${
                        isLit
                          ? "border-warning bg-warning/10"
                          : "border-border bg-surface-card hover:bg-page"
                      }`}
                    >
                      <span
                        className={`font-bold text-sm ${
                          isLit ? "text-warning" : "text-text-primary"
                        }`}
                      >
                        {opt.name}
                      </span>
                      {priceNum > 0 && (
                        <span className="text-xs text-text-secondary mt-0.5">
                          +{formatNumber(priceNum)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {g.options.map((opt) => {
                  const count = picks.filter((p) => p.id === opt.id).length;
                  const canAdd = canAddPortion(picks, g, opt);
                  const priceNum = Number(opt.price);

                  return (
                    <div
                      key={opt.id}
                      className={`flex justify-between items-center px-4 py-3 rounded-xl border transition-colors ${
                        count > 0
                          ? "border-primary bg-primary-soft shadow-sm"
                          : "border-border bg-surface-card hover:bg-page"
                      }`}
                    >
                      <div className="flex flex-col">
                        <span
                          className={`text-sm ${
                            count > 0
                              ? "text-primary font-bold"
                              : "text-text-primary font-medium"
                          }`}
                        >
                          {opt.name}
                        </span>
                        {priceNum > 0 && (
                          <span className="text-xs text-text-secondary mt-0.5">
                            +{formatNumber(priceNum)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => removeManyPortion(opt.id)}
                          disabled={count === 0}
                          aria-label={`Bớt một phần ${opt.name}`}
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${
                            count > 0
                              ? "bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft shadow-sm"
                              : "bg-surface-secondary text-text-muted cursor-not-allowed"
                          }`}
                        >
                          -
                        </button>
                        <span
                          className={`font-bold w-4 text-center ${
                            count > 0 ? "text-primary" : "text-text-secondary"
                          }`}
                        >
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => addManyPortion(g, opt)}
                          disabled={!canAdd}
                          aria-label={`Thêm một phần ${opt.name}`}
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${
                            canAdd
                              ? "bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft shadow-sm"
                              : "bg-surface-secondary text-text-muted cursor-not-allowed"
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {orphanPicks.length > 0 && (
        <div>
          <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">
            Đã chọn trước
          </h4>
          <div className="flex flex-col gap-2">
            {orphanPicks.map((p, idx) => {
              const priceNum = Number(p.price);
              return (
                <div
                  key={`${p.id}-${idx}`}
                  className="flex justify-between items-center px-4 py-3 rounded-xl border border-border bg-surface-card shadow-sm"
                >
                  <div className="flex flex-col">
                    <span className="text-sm text-text-primary font-medium">
                      {p.name}
                    </span>
                    {priceNum > 0 && (
                      <span className="text-xs text-text-secondary mt-0.5">
                        +{formatNumber(priceNum)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => removeOrphanPick(idx)}
                      aria-label={`Bỏ ${p.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft font-bold text-lg transition-colors shadow-sm"
                    >
                      -
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
