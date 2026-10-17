"use client";

import { formatDateTimeFull } from "@/lib/shared/datetime";
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
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import type { OrderDetailV2Result } from "@/app/admin/orders/order-detail-actions";

interface OrderDetailViewProps {
  detail: OrderDetailV2Result;
  brands: any[];
  returnTo: string;
}

function renderPaymentMethod(order: OrderDetailV2Result["order"]) {
  const payments = order.payments ?? [];
  if (payments.length >= 2) {
    const parts = payments.map(
      (p) => `${p.method === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt"} ${formatNumber(p.amount)}đ`,
    );
    return <Badge variant="neutral">{parts.join(" • ")}</Badge>;
  }

  return order.method === "Chuyen khoan" ? (
    <Badge variant="neutral">Chuyển khoản</Badge>
  ) : (
    <Badge variant="success">Tiền mặt</Badge>
  );
}

function formatEventType(type: string): string {
  switch (type) {
    case "CREATED":
      return "Tạo";
    case "EDITED":
      return "Sửa";
    case "VOIDED":
      return "Huỷ";
    case "MIGRATED":
      return "Chuyển dữ liệu cũ";
    default:
      return type;
  }
}

export function OrderDetailView({ detail, brands, returnTo }: OrderDetailViewProps) {
  const currentOrder = detail.order;
  const timeline = detail.timeline || [];
  const events = detail.events || [];
  const promotions = detail.promotions || [];

  const brand = brands.find((b) => b.id === currentOrder.brand_id);
  const orderNo = currentOrder.display_order_no || currentOrder.order_no;
  const voidReason = events.find((e) => e.event_type === "VOIDED")?.reason;

  const hasModifiers = currentOrder.lines.some(
    (line) => line.modifiers && line.modifiers.length > 0
  );
  const hasDiscount = currentOrder.lines.some(
    (line) =>
      (line.promo_discount || 0) +
        (line.manual_item_discount || 0) +
        (line.order_discount_allocation || 0) >
      0
  );

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={returnTo}
        backLabel="Đơn hàng"
        title={orderNo}
        badge={
          currentOrder.version > 1 ? (
            <Badge variant="neutral">v{currentOrder.version}</Badge>
          ) : undefined
        }
        subtitle={
          <>
            {formatDateTimeFull(currentOrder.created_at)}
            {brand && <span className="ml-2 text-primary font-medium">{brand.name}</span>}
          </>
        }
        actions={
          currentOrder.status === "COMPLETED" ? (
            <>
              <Button
                href={`/admin/orders/${encodeURIComponent(currentOrder.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                variant="secondary"
              >
                Sửa đơn
              </Button>
              <VoidOrderButton
                orderId={currentOrder.id}
                returnTo={returnTo}
              />
            </>
          ) : undefined
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
                {hasModifiers && <TableHeaderCell>Tuỳ chọn</TableHeaderCell>}
                <TableHeaderCell>SL</TableHeaderCell>
                {hasDiscount && <TableHeaderCell>Giảm</TableHeaderCell>}
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
                      {hasModifiers && <TableCell>{modifiersText}</TableCell>}
                      <TableCell align="right">{line.qty}</TableCell>
                      {hasDiscount && (
                        <TableCell align="right" tone={discount > 0 ? "negative" : undefined}>
                          {discount > 0 ? `-${formatNumber(discount)}đ` : ""}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {line.gross_line_total > line.net_line_total && (
                          <div className="text-xs text-text-muted line-through">
                            {formatNumber(line.gross_line_total)}đ
                          </div>
                        )}
                        <div>{formatNumber(line.net_line_total)}đ</div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Phone: line rows */}
          <div data-testid="detail-lines-phone" className="md:hidden divide-y divide-border">
            {currentOrder.lines.map((line, idx) => {
              const gross = line.gross_line_total;
              const net = line.net_line_total;
              const qtySize = line.size_name ? `${line.qty} × Size ${line.size_name}` : `${line.qty}`;
              const modifiersText =
                line.modifiers && line.modifiers.length > 0
                  ? `+ ${line.modifiers.map((m: any) => `${Number(m.qty || 1) > 1 ? `${m.qty}x ` : ""}${m.name}`).join(", ")}`
                  : null;
              const totalDiscount =
                (line.promo_discount || 0) +
                (line.manual_item_discount || 0) +
                (line.order_discount_allocation || 0);
              const discountText =
                totalDiscount > 0 ? `Giảm: -${formatNumber(totalDiscount)}đ` : null;
              const meta = [qtySize, modifiersText, discountText].filter(Boolean).join(" · ");

              return (
                <div key={idx} className="px-4 py-2.5">
                  <PhoneRow
                    title={line.product_name}
                    value={
                      gross > net ? (
                        <span>
                          <span className="text-xs text-text-muted line-through mr-1 font-normal">
                            {formatNumber(gross)}đ
                          </span>
                          <span>{formatNumber(net)}đ</span>
                        </span>
                      ) : (
                        `${formatNumber(net)}đ`
                      )
                    }
                    meta={meta}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: side info */}
        <div data-testid="detail-side" className="space-y-6">
          {/* Card 1: badges, breakdown, void reason */}
          <div className="bg-surface-card rounded-card shadow-sm border border-border p-5 space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              {renderPaymentMethod(currentOrder)}
              <Badge variant="neutral">{currentOrder.created_by_name}</Badge>
              {currentOrder.status === "VOIDED" && (
                <Badge variant="danger">Đã huỷ</Badge>
              )}
            </div>

            {currentOrder.status === "VOIDED" && voidReason && (
              <div className="text-sm text-text-secondary">
                Lý do huỷ: <span className="text-text-primary font-medium">{voidReason}</span>
              </div>
            )}

            {/* Money breakdown */}
            <div className="bg-page rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-text-secondary">Tổng gốc</span>
                <span className="text-text-primary">{formatNumber(currentOrder.gross_total)}đ</span>
              </div>
              {promotions.length > 0 ? (
                promotions
                  .filter((p) => p.amount > 0)
                  .map((p, idx) => (
                    <div key={p.promotion_id || idx} className="flex justify-between text-success">
                      <span>{p.name || p.code || "Khuyến mãi"}</span>
                      <span>-{formatNumber(p.amount)}đ</span>
                    </div>
                  ))
              ) : currentOrder.promo_discount_total > 0 ? (
                <div className="flex justify-between text-success">
                  <span>Khuyến mãi hệ thống</span>
                  <span>-{formatNumber(currentOrder.promo_discount_total)}đ</span>
                </div>
              ) : null}
              {currentOrder.manual_item_discount_total > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Giảm thủ công từng món</span>
                  <span>-{formatNumber(currentOrder.manual_item_discount_total)}đ</span>
                </div>
              )}
              {currentOrder.manual_order_discount > 0 && (
                <div className="flex justify-between text-danger">
                  <span>Giảm cả đơn</span>
                  <span>-{formatNumber(currentOrder.manual_order_discount)}đ</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1 border-t border-border">
                <span className="text-text-primary">Khách trả</span>
                <span className="text-primary">{formatNumber(currentOrder.net_total)}đ</span>
              </div>
            </div>
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
                      <div className="text-text-secondary tabular-nums">{formatDateTimeFull(v.created_at)}</div>
                      <div className="text-text-muted">{formatNumber(v.net_total)}đ</div>
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
                      <span className="font-bold text-text-primary">{formatEventType(e.event_type)}</span>
                      <span className="text-text-secondary tabular-nums">{formatDateTimeFull(e.event_at)}</span>
                    </div>
                    <div className="text-text-secondary mt-0.5">
                      {e.actor_name}: {e.reason === "POS checkout" ? "Bán tại máy bán hàng" : e.reason}
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
