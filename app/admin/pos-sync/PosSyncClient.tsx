"use client";

import { useState } from "react";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { Button } from "@/components/ui/Button";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { resolvePosSyncFailure } from "./actions";
import type { PosSyncFailureItem, PosSyncLateOrder } from "./actions";

export function PosSyncClient({
  lateOrders,
  failures,
}: {
  lateOrders: PosSyncLateOrder[];
  failures: PosSyncFailureItem[];
}) {
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const handleResolve = async (id: string) => {
    const res = await resolvePosSyncFailure(id);
    if (res.success) {
      setResolvedIds(prev => new Set(prev).add(id));
    }
  };

  const activeFailures = failures.filter(f => !resolvedIds.has(f.id));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn gửi lại thất bại thật sự — cần xử lý tay
        </h2>
        {activeFailures.length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mã yêu cầu</TableHeaderCell>
                  <TableHeaderCell>Lỗi</TableHeaderCell>
                  <TableHeaderCell>Thời điểm</TableHeaderCell>
                  <TableHeaderCell></TableHeaderCell>
                </TableHead>
                <TableBody>
                  {activeFailures.map(f => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <span className="font-mono text-xs">{f.request_token}</span>
                      </TableCell>
                      <TableCell>{f.error_message}</TableCell>
                      <TableCell>{formatDateTimeFull(f.occurred_at)}</TableCell>
                      <TableCell align="right">
                        <Button
                          variant="secondary"
                          onClick={() => handleResolve(f.id)}
                        >
                          Đã xử lý
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-3">
              {activeFailures.map(f => (
                <div key={f.id} className="rounded-card border border-border bg-surface-card p-4 space-y-2">
                  <div className="font-mono text-xs text-text-primary">{f.request_token}</div>
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-muted">Lỗi:</span> {f.error_message}
                  </p>
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-muted">Thời điểm:</span> {formatDateTimeFull(f.occurred_at)}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleResolve(f.id)}
                      className="w-full"
                    >
                      Đã xử lý
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn đồng bộ trễ, 30 ngày gần nhất (chỉ để biết, không cần xử lý)
        </h2>
        {lateOrders.length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mã đơn</TableHeaderCell>
                  <TableHeaderCell>Giờ bán thực tế</TableHeaderCell>
                  <TableHeaderCell>Trễ bao lâu</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {lateOrders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>{o.order_no}</TableCell>
                      <TableCell>{formatDateTimeFull(o.created_at)}</TableCell>
                      <TableCell>{o.delayMinutes} phút</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden space-y-3">
              {lateOrders.map(o => (
                <div key={o.id} className="rounded-card border border-border bg-surface-card p-4 space-y-2">
                  <div className="text-sm text-text-primary">{o.order_no}</div>
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-muted">Giờ bán thực tế:</span> {formatDateTimeFull(o.created_at)}
                  </p>
                  <p className="text-sm text-text-secondary">
                    <span className="text-text-muted">Trễ bao lâu:</span> {o.delayMinutes} phút
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
