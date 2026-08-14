"use client";

import { formatNumber } from "@/lib/format";

interface DraftsModalProps {
  drafts: any[];
  calculateItemTotal: (item: any) => number;
  onLoad: (draftId: string) => void;
  onDelete: (draftId: string) => void;
  onClose: () => void;
}

export function DraftsModal({ drafts, calculateItemTotal, onLoad, onDelete, onClose }: DraftsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card/95 backdrop-blur-2xl border border-border/40 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        <div className="p-5 border-b border-border/50 flex justify-between items-center bg-page/50">
          <h3 className="text-xl font-bold text-text-primary">Danh sách đơn nháp</h3>
          <button
            onClick={onClose}
            className="p-1.5 bg-border rounded-full text-text-secondary hover:bg-border"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 bg-surface-card space-y-4 max-h-[60vh] overflow-y-auto">
          {drafts.length === 0 ? (
            <div className="text-center py-8 text-text-secondary font-medium">
              Chưa có đơn nháp nào.
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((d: any) => {
                const totalAmt = d.cart.reduce((sum: number, item: any) => sum + calculateItemTotal(item), 0);
                const totalItems = d.cart.reduce((sum: number, item: any) => sum + item.qty, 0);

                return (
                  <div key={d.id} className="p-3 bg-page border border-border rounded-xl flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-text-primary truncate">{d.name || "Đơn nháp"}</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        {totalItems} món • {formatNumber(totalAmt)}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => onLoad(d.id)}
                        className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition active:scale-95"
                      >
                        Nạp
                      </button>
                      <button
                        onClick={() => onDelete(d.id)}
                        className="bg-danger/10 hover:bg-danger/20 text-danger font-bold text-xs px-3 py-1.5 rounded-lg transition active:scale-95"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
