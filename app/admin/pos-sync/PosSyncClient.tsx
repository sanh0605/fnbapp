"use client";

import { useState } from "react";
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

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn gửi lại thất bại thật sự — cần xử lý tay
        </h2>
        {failures.filter(f => !resolvedIds.has(f.id)).length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-2">Mã yêu cầu</th>
                <th className="py-2">Lỗi</th>
                <th className="py-2">Thời điểm</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {failures.filter(f => !resolvedIds.has(f.id)).map(f => (
                <tr key={f.id} className="border-b border-border/50">
                  <td className="py-2 font-mono text-xs">{f.request_token}</td>
                  <td className="py-2">{f.error_message}</td>
                  <td className="py-2">{new Date(f.occurred_at).toLocaleString("vi-VN")}</td>
                  <td className="py-2">
                    <button
                      onClick={() => handleResolve(f.id)}
                      className="text-primary font-bold hover:underline"
                    >
                      Đã xử lý
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold text-text-primary mb-3">
          Đơn đồng bộ trễ (chỉ để biết, không cần xử lý)
        </h2>
        {lateOrders.length === 0 ? (
          <p className="text-text-muted text-sm">Không có đơn nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-2">Mã đơn</th>
                <th className="py-2">Giờ bán thực tế</th>
                <th className="py-2">Trễ bao lâu</th>
              </tr>
            </thead>
            <tbody>
              {lateOrders.map(o => (
                <tr key={o.id} className="border-b border-border/50">
                  <td className="py-2">{o.order_no}</td>
                  <td className="py-2">{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                  <td className="py-2">{o.delayMinutes} phút</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
