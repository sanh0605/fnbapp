"use client";

import { useState, useEffect } from "react";
import { getOrderDetailV2, type OrderListItem } from "./actions";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { X } from "lucide-react";

interface Props {
  order: OrderListItem;
  brands: any[];
  onClose: () => void;
  onEdit: (freshOrder: any) => void;
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

  // Claude code — UI-1: use shared datetime helper (Asia/Saigon timezone).
  const formatDate = (s: string) => formatDateTime(s);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-surface-card p-6 rounded-card">Đang tải...</div>
      </div>
    );
  }

  const currentOrder = detail?.order || order;
  const timeline = detail?.timeline || [];
  const events = detail?.events || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface-card w-full max-w-lg max-h-[90vh] rounded-card shadow-2xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-border bg-page flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-text-primary">
              {orderNo}
              {currentOrder.version > 1 && (
                <span className="ml-2 text-xs font-bold text-primary bg-primary-soft px-2 py-0.5 rounded">
                  v{currentOrder.version}
                </span>
              )}
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">
              {formatDate(currentOrder.created_at)}
              {brand && <span className="ml-2 text-primary font-medium">{brand.name}</span>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="p-2 bg-surface-secondary rounded-full text-text-muted hover:bg-border min-w-[36px] min-h-[36px] flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-3">
            {currentOrder.method === "Chuyen khoan" ? (
              <Badge variant="neutral">Chuyển khoản</Badge>
            ) : (
              <Badge variant="success">Tiền mặt</Badge>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-secondary text-text-secondary">
              {currentOrder.created_by_name}
            </span>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            {currentOrder.lines.map((line: any, idx: number) => {
              const gross = line.gross_line_total;
              const net = line.net_line_total;
              return (
                <div key={idx} className="bg-page rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-text-primary">
                        <span className="text-primary mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">Size {line.size_name}</div>
                      {line.modifiers?.length > 0 && (
                        <div className="text-xs text-primary mt-1">
                          + {line.modifiers.map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`).join(", ")}
                        </div>
                      )}
                      {(line.promo_discount + line.manual_item_discount + line.order_discount_allocation) > 0 && (
                        <div className="text-xs text-danger mt-1">
                          Giảm: -{formatNumber(line.promo_discount + line.manual_item_discount + line.order_discount_allocation)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {gross > net && (
                        <div className="text-[11px] text-text-muted line-through">{formatNumber(gross)}</div>
                      )}
                      <div className="font-bold text-text-primary">{formatNumber(net)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Money breakdown */}
          <div className="bg-page rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-text-secondary">Tổng gốc</span>
              <span className="text-text-primary">{formatNumber(currentOrder.gross_total)}</span>
            </div>
            {currentOrder.promo_discount_total > 0 && (
              <div className="flex justify-between text-success">
                <span>Khuyến mãi hệ thống</span>
                <span>-{formatNumber(currentOrder.promo_discount_total)}</span>
              </div>
            )}
            {currentOrder.manual_item_discount_total > 0 && (
              <div className="flex justify-between text-danger">
                <span>Giảm thủ công từng món</span>
                <span>-{formatNumber(currentOrder.manual_item_discount_total)}</span>
              </div>
            )}
            {currentOrder.manual_order_discount > 0 && (
              <div className="flex justify-between text-danger">
                <span>Giảm cả đơn</span>
                <span>-{formatNumber(currentOrder.manual_order_discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-border">
              <span className="text-text-primary">Khách trả</span>
              <span className="text-primary">{formatNumber(currentOrder.net_total)}</span>
            </div>
          </div>

          {/* Timeline */}
          {timeline.length > 1 && (
            <div>
              <h4 className="text-sm font-bold text-text-secondary mb-2">Lịch sử phiên bản ({timeline.length})</h4>
              <div className="space-y-1.5">
                {timeline.map(v => (
                  <div key={v.id} className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center ${
                    v.id === currentOrder.id ? "bg-primary-soft border border-primary" : "bg-page"
                  }`}>
                    <div>
                      <span className="font-bold text-text-primary">v{v.version}</span>
                      <span className="ml-2 text-text-secondary">{v.created_by_name}</span>
                      {v.status === "SUPERSEDED" && <span className="ml-2 text-text-muted">(đã thay thế)</span>}
                      {v.status === "VOIDED" && <span className="ml-2 text-danger">(đã hủy)</span>}
                    </div>
                    <div className="text-right">
                      <div className="text-text-secondary">{formatDate(v.created_at)}</div>
                      <div className="text-text-muted">{formatNumber(v.net_total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events */}
          {events.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-text-secondary mb-2">Sự kiện ({events.length})</h4>
              <div className="space-y-1.5">
                {events.map(e => (
                  <div key={e.id} className="text-xs px-3 py-2 bg-page rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-bold text-text-primary">{e.event_type}</span>
                      <span className="text-text-secondary">{formatDate(e.event_at)}</span>
                    </div>
                    <div className="text-text-secondary mt-0.5">{e.actor_name}: {e.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border shrink-0">
          <div className="px-5 py-4 flex gap-3 bg-surface-card">
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => onEdit(detail?.order || order)}
              disabled={currentOrder.status !== "COMPLETED"}
            >
              Sửa đơn
            </Button>
            <Button
              variant="secondary"
              className="!text-danger hover:!bg-danger/10"
              onClick={onVoid}
              disabled={currentOrder.status !== "COMPLETED"}
            >
              Hủy đơn
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
