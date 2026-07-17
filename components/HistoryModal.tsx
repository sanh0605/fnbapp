"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { buildPriceHistoryTimeline } from "@/lib/price-history";
import { formatNumber } from "@/lib/format";
import { History, X } from "lucide-react";

export default function HistoryModal({ title, recipeHistory, priceHistory }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const priceTimeline = buildPriceHistoryTimeline(priceHistory || []);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "Hiện tại";
    const d = new Date(isoStr);
    const dd = d.getDate().toString().padStart(2, '0');
    const MM = (d.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    return `${dd}/${MM}/${yyyy} ${hh}:${mm}:${ss}`;
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="text-sm font-medium text-warning hover:text-amber-800 flex items-center gap-1"
        title="Xem lịch sử thay đổi"
      >
        <History className="w-4 h-4" />
        Lịch sử
      </button>

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-card shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex justify-between items-center bg-page">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <History className="w-6 h-6 text-warning" />
                Lịch sử: {title}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 bg-page">
              
              {/* LỊCH SỬ GIÁ BÁN */}
              {priceTimeline.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-4 border-b pb-2">Lịch sử Giá Bán</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                    {priceTimeline.map((entry) => (
                      <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-warning text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 bg-surface-card rounded-lg shadow-sm border border-border">
                          <div className="text-xs font-bold text-text-muted mb-1">
                            Từ: {formatDate(entry.effectiveAt)}
                            <br/>
                            Đến: {formatDate(entry.endAt || "")}
                          </div>
                          <div className="font-bold text-primary text-base">
                            {formatNumber(entry.newPrice)}
                          </div>
                          {entry.isCurrent && (
                            <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                              Đang áp dụng
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LỊCH SỬ CÔNG THỨC */}
              {recipeHistory && recipeHistory.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-4 border-b pb-2">Lịch sử Công Thức (Định mức)</h3>
                  <div className="space-y-4">
                    {recipeHistory.map((r:any, idx:number) => (
                      <div key={idx} className={`p-4 rounded-xl border ${!r.end_date ? 'bg-success/10/50 border-emerald-200' : 'bg-surface-card border-border'} shadow-sm relative`}>
                        {!r.end_date && (
                          <div className="absolute top-3 right-3 bg-success text-white text-[10px] font-bold px-2 py-1 rounded">
                            Đang áp dụng
                          </div>
                        )}
                        <div className="text-sm font-bold text-text-secondary mb-3 flex flex-col sm:flex-row sm:gap-4">
                          <span>Bắt đầu: <span className="text-text-primary">{formatDate(r.created_at)}</span></span>
                          {r.end_date && <span>Kết thúc: <span className="text-text-primary">{formatDate(r.end_date)}</span></span>}
                        </div>
                        
                        <div className="bg-page p-3 rounded-lg border border-border">
                          {r.ingredients.length === 0 ? (
                            <span className="text-text-muted italic text-sm">Chưa khai báo thành phần</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {r.ingredients.map((ing:any, iIdx:number) => (
                                <li key={iIdx} className="text-sm flex justify-between border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                                  <span className="font-medium text-text-primary">{ing.name}</span>
                                  <span className="font-bold text-primary">{ing.quantity} {ing.unitName}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {(!priceHistory || priceHistory.length === 0) && (!recipeHistory || recipeHistory.length === 0) && (
                <div className="text-center py-8 text-text-secondary italic">
                  Chưa có lịch sử thay đổi nào.
                </div>
              )}

            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
