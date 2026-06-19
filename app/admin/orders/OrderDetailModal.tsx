"use client";

import { useState, useEffect } from "react";
import { getOrderDetailV2, type OrderListItem } from "@/app/actions/orders-v2";

interface Props {
  order: OrderListItem;
  brands: any[];
  onClose: () => void;
  onEdit: () => void;
  onVoid: () => void;
}

export default function OrderDetailModal({ order, brands, onClose, onEdit, onVoid }: Props) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getOrderDetailV2>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrderDetailV2(order.id).then(d => {
      setDetail(d);
      setLoading(false);
    });
  }, [order.id]);

  const brand = brands.find(b => b.id === order.brand_id);
  const orderNo = order.display_order_no || order.order_no;

  const formatDate = (s: string) => {
    const d = new Date(s);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
        <div className="bg-white p-6 rounded-xl">Đang tải...</div>
      </div>
    );
  }

  const currentOrder = detail?.order || order;
  const timeline = detail?.timeline || [];
  const events = detail?.events || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {orderNo}
              {currentOrder.version > 1 && (
                <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  v{currentOrder.version}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(currentOrder.created_at)}
              {brand && <span className="ml-2 text-blue-600 font-medium">{brand.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${currentOrder.method === "Chuyen khoan" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
              {currentOrder.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
              {currentOrder.created_by_name}
            </span>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            {currentOrder.lines.map((line: any, idx: number) => {
              const gross = line.gross_line_total;
              const net = line.net_line_total;
              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">
                        <span className="text-orange-600 mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Size {line.size_name}</div>
                      {line.modifiers?.length > 0 && (
                        <div className="text-xs text-indigo-600 mt-1">
                          + {line.modifiers.map((m: any) => m.name).join(", ")}
                        </div>
                      )}
                      {(line.promo_discount + line.manual_item_discount + line.order_discount_allocation) > 0 && (
                        <div className="text-xs text-red-500 mt-1">
                          Giảm: -{(line.promo_discount + line.manual_item_discount + line.order_discount_allocation).toLocaleString("vi-VN")}đ
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {gross > net && (
                        <div className="text-[11px] text-gray-400 line-through">{gross.toLocaleString("vi-VN")}đ</div>
                      )}
                      <div className="font-bold text-gray-800">{net.toLocaleString("vi-VN")}đ</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Money breakdown */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Tổng gốc</span>
              <span>{currentOrder.gross_total.toLocaleString("vi-VN")}đ</span>
            </div>
            {currentOrder.promo_discount_total > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Khuyến mãi hệ thống</span>
                <span>-{currentOrder.promo_discount_total.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {currentOrder.manual_item_discount_total > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Giảm thủ công từng món</span>
                <span>-{currentOrder.manual_item_discount_total.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            {currentOrder.manual_order_discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Giảm cả đơn</span>
                <span>-{currentOrder.manual_order_discount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
              <span className="text-gray-900">Khách trả</span>
              <span className="text-orange-600">{currentOrder.net_total.toLocaleString("vi-VN")}đ</span>
            </div>
          </div>

          {/* Timeline */}
          {timeline.length > 1 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">Lịch sử phiên bản ({timeline.length})</h4>
              <div className="space-y-1.5">
                {timeline.map(v => (
                  <div key={v.id} className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center ${
                    v.id === currentOrder.id ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                  }`}>
                    <div>
                      <span className="font-bold text-gray-700">v{v.version}</span>
                      <span className="ml-2 text-gray-600">{v.created_by_name}</span>
                      {v.status === "SUPERSEDED" && <span className="ml-2 text-gray-400">(đã thay thế)</span>}
                      {v.status === "VOIDED" && <span className="ml-2 text-red-500">(đã hủy)</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500">{formatDate(v.created_at)}</div>
                      <div className="text-gray-400">{v.net_total.toLocaleString("vi-VN")}đ</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {events.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-2">Sự kiện ({events.length})</h4>
              <div className="space-y-1.5">
                {events.map(e => (
                  <div key={e.id} className="text-xs px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-bold text-gray-700">{e.event_type}</span>
                      <span className="text-gray-500">{formatDate(e.event_at)}</span>
                    </div>
                    <div className="text-gray-600 mt-0.5">{e.actor_name}: {e.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 shrink-0">
          <div className="px-5 py-4 flex gap-3 bg-white">
            <button
              onClick={onEdit}
              disabled={currentOrder.status !== "COMPLETED"}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Sửa đơn
            </button>
            <button
              onClick={onVoid}
              disabled={currentOrder.status !== "COMPLETED"}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Hủy đơn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
