"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { buildPriceHistoryTimeline } from "@/lib/price-history";
import { formatNumber } from "@/lib/format";

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
        className="text-sm font-medium text-amber-600 hover:text-amber-800 flex items-center gap-1"
        title="Xem lịch sử thay đổi"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Lịch sử
      </button>

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Lịch sử: {title}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 bg-gray-50/30">
              
              {/* LỊCH SỬ GIÁ BÁN */}
              {priceTimeline.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Lịch sử Giá Bán</h3>
                  <div className="space-y-3 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                    {priceTimeline.map((entry) => (
                      <div key={entry.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-amber-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                        <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 bg-white rounded-lg shadow-sm border border-gray-100">
                          <div className="text-xs font-bold text-gray-400 mb-1">
                            Từ: {formatDate(entry.effectiveAt)}
                            <br/>
                            Đến: {formatDate(entry.endAt || "")}
                          </div>
                          <div className="font-bold text-indigo-700 text-base">
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
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Lịch sử Công Thức (Định mức)</h3>
                  <div className="space-y-4">
                    {recipeHistory.map((r:any, idx:number) => (
                      <div key={idx} className={`p-4 rounded-xl border ${!r.end_date ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-200'} shadow-sm relative`}>
                        {!r.end_date && (
                          <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                            Đang áp dụng
                          </div>
                        )}
                        <div className="text-sm font-bold text-gray-500 mb-3 flex flex-col sm:flex-row sm:gap-4">
                          <span>Bắt đầu: <span className="text-gray-800">{formatDate(r.created_at)}</span></span>
                          {r.end_date && <span>Kết thúc: <span className="text-gray-800">{formatDate(r.end_date)}</span></span>}
                        </div>
                        
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          {r.ingredients.length === 0 ? (
                            <span className="text-gray-400 italic text-sm">Chưa khai báo thành phần</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {r.ingredients.map((ing:any, iIdx:number) => (
                                <li key={iIdx} className="text-sm flex justify-between border-b border-gray-200/60 pb-1.5 last:border-0 last:pb-0">
                                  <span className="font-medium text-gray-700">{ing.name}</span>
                                  <span className="font-bold text-indigo-600">{ing.quantity} {ing.unitName}</span>
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
                <div className="text-center py-8 text-gray-500 italic">
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
