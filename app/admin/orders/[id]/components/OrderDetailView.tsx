"use client";

import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { VoidOrderButton } from "@/app/admin/orders/components/VoidOrderButton";
import type { OrderDetailV2Result } from "@/app/admin/orders/order-detail-actions";

interface OrderDetailViewProps {
  detail: OrderDetailV2Result;
  brands: any[];
  returnTo: string;
}

export function OrderDetailView({ detail, brands, returnTo }: OrderDetailViewProps) {
  const router = useRouter();
  const currentOrder = detail.order;
  const timeline = detail.timeline || [];
  const events = detail.events || [];

  const brand = brands.find((b) => b.id === currentOrder.brand_id);
  const orderNo = currentOrder.display_order_no || currentOrder.order_no;

  const formatDate = (s: string) => formatDateTime(s);

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={returnTo}
        backLabel="Đơn hàng"
        title={orderNo}
        badge={
          currentOrder.version > 1 ? (
            <span className="text-xs font-bold text-primary bg-primary-soft px-2 py-0.5 rounded">
              v{currentOrder.version}
            </span>
          ) : undefined
        }
        subtitle={
          <>
            {formatDate(currentOrder.created_at)}
            {brand && <span className="ml-2 text-primary font-medium">{brand.name}</span>}
          </>
        }
      />

      <div data-testid="detail-layout" className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        {/* Left: dishes */}
        <div data-testid="detail-lines" className="lg:col-span-2 bg-surface-card rounded-card shadow-sm border border-border p-5">
          {/* Computer: shared Table */}
          <div className="hidden md:block">
            <Table>
              <TableHead>
                <TableHeaderCell>Món</TableHeaderCell>
                <TableHeaderCell>Size</TableHeaderCell>
                <TableHeaderCell>Tuỳ chọn</TableHeaderCell>
                <TableHeaderCell>SL</TableHeaderCell>
                <TableHeaderCell>Giảm</TableHeaderCell>
                <TableHeaderCell>Thành tiền</TableHeaderCell>
              </TableHead>
              <TableBody>
                {currentOrder.lines.map((line, idx) => {
                  const discount =
                    (line.promo_discount || 0) +
                    (line.manual_item_discount || 0) +
                    (line.order_discount_allocation || 0);
                  const modifiersText =
                    line.modifiers && line.modifiers.length > 0
                      ? line.modifiers
                          .map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`)
                          .join(", ")
                      : "";

                  return (
                    <TableRow key={idx}>
                      <TableCell>{line.product_name}</TableCell>
                      <TableCell>{line.size_name}</TableCell>
                      <TableCell>{modifiersText}</TableCell>
                      <TableCell align="right">{line.qty}</TableCell>
                      <TableCell align="right" tone={discount > 0 ? "negative" : undefined}>
                        {discount > 0 ? `-${formatNumber(discount)}` : ""}
                      </TableCell>
                      <TableCell align="right">
                        {line.gross_line_total > line.net_line_total && (
                          <div className="text-[11px] text-text-muted line-through">
                            {formatNumber(line.gross_line_total)}
                          </div>
                        )}
                        <div>{formatNumber(line.net_line_total)}</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Phone: line cards */}
          <div data-testid="detail-lines-phone" className="md:hidden space-y-3">
            {currentOrder.lines.map((line, idx) => {
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
                      {line.modifiers && line.modifiers.length > 0 && (
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
        </div>

        {/* Right: side info */}
        <div data-testid="detail-side" className="space-y-6">
          {/* Card 1: badges, breakdown, actions */}
          <div className="bg-surface-card rounded-card shadow-sm border border-border p-5 space-y-4">
            <div className="flex gap-3 items-center">
              {currentOrder.method === "Chuyen khoan" ? (
                <Badge variant="neutral">Chuyển khoản</Badge>
              ) : (
                <Badge variant="success">Tiền mặt</Badge>
              )}
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-secondary text-text-secondary">
                {currentOrder.created_by_name}
              </span>
              {currentOrder.status === "VOIDED" && (
                <Badge variant="danger">Đã huỷ</Badge>
              )}
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

            {/* Actions for COMPLETED order */}
            {currentOrder.status === "COMPLETED" && (
              <div className="flex gap-3">
                <Button
                  href={`/admin/orders/${encodeURIComponent(currentOrder.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                  variant="secondary"
                  className="flex-1"
                >
                  Sửa đơn
                </Button>
                <VoidOrderButton
                  orderId={currentOrder.id}
                  orderNo={orderNo}
                  className="flex-1"
                  onVoided={() => {
                    router.push(returnTo);
                    router.refresh();
                  }}
                />
              </div>
            )}
          </div>

          {/* Card 2: Timeline */}
          {timeline.length > 1 && (
            <div className="bg-surface-card rounded-card shadow-sm border border-border p-5">
              <h2 className="text-sm font-bold text-text-secondary mb-2">Lịch sử phiên bản ({timeline.length})</h2>
              <div className="space-y-1.5">
                {timeline.map((v) => (
                  <div
                    key={v.id}
                    className={`text-xs px-3 py-2 rounded-lg flex justify-between items-center ${
                      v.id === currentOrder.id ? "bg-primary-soft border border-primary" : "bg-page"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-text-primary">v{v.version}</span>
                      <span className="ml-2 text-text-secondary">{v.created_by_name}</span>
                      {v.status === "SUPERSEDED" && <span className="ml-2 text-text-muted">(đã thay thế)</span>}
                      {v.status === "VOIDED" && <span className="ml-2 text-danger">(đã huỷ)</span>}
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

          {/* Card 3: Events */}
          {events.length > 0 && (
            <div className="bg-surface-card rounded-card shadow-sm border border-border p-5">
              <h2 className="text-sm font-bold text-text-secondary mb-2">Sự kiện ({events.length})</h2>
              <div className="space-y-1.5">
                {events.map((e) => (
                  <div key={e.id} className="text-xs px-3 py-2 bg-page rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-bold text-text-primary">{e.event_type}</span>
                      <span className="text-text-secondary">{formatDate(e.event_at)}</span>
                    </div>
                    <div className="text-text-secondary mt-0.5">
                      {e.actor_name}: {e.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
