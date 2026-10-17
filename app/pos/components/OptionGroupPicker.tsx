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
  startNumber?: number;
}

export function OptionGroupPicker({
  groups,
  picks,
  onChange,
  startNumber = 2,
}: OptionGroupPickerProps) {
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
    <>
      {groups.map((g, groupIdx) => {
        const isOne = g.group.selection_mode === "ONE";
        const litId = isOne ? litOptionId(picks, g) : null;
        const litOption = isOne ? g.options.find((o) => o.id === litId) : undefined;
        const groupNumber = startNumber + groupIdx;

        return (
          <div
            key={g.group.id}
            className="bg-surface-card border border-border rounded-card overflow-hidden flex flex-col"
          >
            <div className="flex items-center gap-2.5 min-h-[46px] md:min-h-[42px] px-3.5 md:px-2.5 bg-surface-secondary border-b border-border shrink-0">
              <b className="w-[26px] h-[26px] md:w-6 md:h-6 rounded-full bg-primary text-on-primary text-[14px] md:text-[13px] font-extrabold flex items-center justify-center shrink-0">
                {groupNumber}
              </b>
              <span className="text-[17px] md:text-[16px] font-extrabold text-text-primary">
                {g.group.name}
              </span>
              {isOne && litOption && (
                <span className="ml-auto text-[14px] font-bold text-primary md:hidden">
                  ✓ {litOption.name}
                </span>
              )}
            </div>

            {isOne ? (
              <div className="flex flex-col">
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
                      className={`w-full flex items-center min-h-[54px] md:min-h-[46px] px-3.5 md:px-2.5 border-t border-border first:border-t-0 text-[18px] md:text-[16px] text-left transition-colors ${
                        isLit
                          ? "border-primary bg-primary-soft text-primary font-bold"
                          : "bg-surface-card text-text-primary font-medium hover:bg-page"
                      }`}
                    >
                      <span
                        className={
                          isLit ? "text-primary font-bold" : "text-text-primary font-medium"
                        }
                      >
                        {opt.name}
                      </span>
                      {priceNum > 0 && (
                        <span className="ml-auto mr-3 md:mr-2 text-[16px] md:text-[15px] text-text-secondary font-normal">
                          +{formatNumber(priceNum)}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className={`w-[26px] h-[26px] md:w-[22px] md:h-[22px] rounded-full shrink-0 ${
                          priceNum > 0 ? "" : "ml-auto"
                        } ${
                          isLit
                            ? "border-[8px] md:border-[7px] border-primary"
                            : "border-2 border-border"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col">
                {g.options.map((opt) => {
                  const count = picks.filter((p) => p.id === opt.id).length;
                  const canAdd = canAddPortion(picks, g, opt);
                  const priceNum = Number(opt.price);

                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        if (canAdd) addManyPortion(g, opt);
                      }}
                      className={`flex items-center justify-between min-h-[54px] md:min-h-[46px] px-3.5 md:px-2.5 border-t border-border first:border-t-0 text-[18px] md:text-[16px] transition-colors cursor-pointer ${
                        count > 0
                          ? "border-primary bg-primary-soft text-primary font-bold"
                          : "bg-surface-card text-text-primary font-medium hover:bg-page"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className={
                            count > 0 ? "text-primary font-bold" : "text-text-primary font-medium"
                          }
                        >
                          {opt.name}
                        </span>
                        {count >= 1 && (opt.max_qty ?? Infinity) > 1 && (
                          <b className="text-xs font-extrabold text-primary">×{count}</b>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {priceNum > 0 && (
                          <span className="text-[16px] md:text-[15px] text-text-secondary font-normal mr-1">
                            +{formatNumber(priceNum)}
                          </span>
                        )}
                        {count >= 1 && (
                          <button
                            type="button"
                            onClick={() => removeManyPortion(opt.id)}
                            aria-label={`Bớt một phần ${opt.name}`}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-button font-bold text-lg transition-colors text-primary hover:bg-surface-card"
                          >
                            −
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => addManyPortion(g, opt)}
                          disabled={!canAdd}
                          aria-label={`Thêm một phần ${opt.name}`}
                          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-button font-bold transition-colors ${
                            canAdd
                              ? "text-primary"
                              : "text-text-muted opacity-40 cursor-not-allowed"
                          }`}
                        >
                          <b
                            aria-hidden="true"
                            className={`w-[26px] h-[26px] md:w-[22px] md:h-[22px] rounded-[7px] md:rounded-[6px] border-2 flex items-center justify-center text-sm font-black ${
                              count > 0
                                ? "bg-primary border-primary text-on-primary"
                                : "border-border bg-surface-card text-text-secondary"
                            }`}
                          >
                            {count > 0 ? "✓" : ""}
                          </b>
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
        <div className="bg-surface-card border border-border rounded-card overflow-hidden flex flex-col">
          <div className="flex items-center min-h-[46px] md:min-h-[42px] px-3.5 md:px-2.5 bg-surface-secondary border-b border-border text-[17px] md:text-[16px] font-extrabold text-text-primary">
            Đã chọn trước
          </div>
          <div className="flex flex-col">
            {orphanPicks.map((p, idx) => {
              const priceNum = Number(p.price);
              return (
                <div
                  key={`${p.id}-${idx}`}
                  className="flex justify-between items-center min-h-[54px] md:min-h-[46px] px-3.5 md:px-2.5 border-t border-border first:border-t-0 bg-surface-card text-[18px] md:text-[16px]"
                >
                  <div className="flex flex-col">
                    <span className="text-text-primary font-medium">{p.name}</span>
                    {priceNum > 0 && (
                      <span className="text-xs text-text-secondary mt-0.5">
                        +{formatNumber(priceNum)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => removeOrphanPick(idx)}
                      aria-label={`Bỏ ${p.name}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-button bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
