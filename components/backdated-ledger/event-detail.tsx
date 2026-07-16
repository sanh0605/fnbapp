"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { StatusBadge } from "./status-badge";
import { AffectedLinesTable } from "./affected-lines-table";
import { ApplyModal } from "./apply-modal";
import { RejectModal } from "./reject-modal";
import type { BackdatedEventRecoveryPlan } from "@/lib/backdated-ledger/recompute-event";
import { approveAndRecomputeAction, rejectEventAction } from "@/app/admin/audit/backdated-ledger/actions";

interface EventDetailProps {
  event: any; // from backdated_ledger_events
  plan: BackdatedEventRecoveryPlan | null;
}

export function EventDetail({ event, plan }: EventDetailProps) {
  const router = useRouter();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Compute lag duration
  const effectiveTime = new Date(event.effective_timestamp).getTime();
  const visibilityTime = new Date(event.visibility_timestamp).getTime();
  const lagMs = visibilityTime - effectiveTime;
  const lagDays = Math.floor(lagMs / (1000 * 60 * 60 * 24));
  const lagHours = Math.floor((lagMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const lagText = lagDays > 0 ? `${lagDays} days ${lagHours} hours` : `${lagHours} hours`;

  const totalDeltaVnd = plan?.changes.reduce((sum, c) => sum + (c.new_cost_at_sale - c.old_cost_at_sale), 0) || 0;
  
  const handleApprove = async (reviewer: string) => {
    const res = await approveAndRecomputeAction(event.id, reviewer);
    if (!res.success) {
      throw new Error(res.error);
    }
    setShowApplyModal(false);
    router.refresh();
  };

  const handleReject = async (reason: string, reviewer: string) => {
    const res = await rejectEventAction(event.id, reviewer, reason);
    if (!res.success) {
      throw new Error(res.error);
    }
    setShowRejectModal(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Event Metadata Card */}
      <div className="bg-surface-card rounded-lg shadow border border-border p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-lg font-medium text-text-primary mb-1">Chi tiết giao dịch</h2>
            <div className="text-sm text-text-secondary">ID: {event.id}</div>
          </div>
          <StatusBadge status={event.status} className="text-sm px-3 py-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
          <div>
            <div className="text-text-secondary mb-1">Detected at</div>
            <div className="font-medium">{formatDateTime(event.detected_at)}</div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Source</div>
            <div className="font-medium">{event.source_table} / {event.source_id}</div>
          </div>
          
          <div>
            <div className="text-text-secondary mb-1">Time Lag (Effective → Visibility)</div>
            <div className="font-medium">
              {formatDateTime(event.effective_timestamp)} → {formatDateTime(event.visibility_timestamp)}
              <span className="text-text-secondary ml-2">({lagText})</span>
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Item Reference</div>
            <div className="font-medium">{event.item_reference}</div>
          </div>

          <div>
            <div className="text-text-secondary mb-1">Quantity Change</div>
            <div className={`font-medium flex items-center ${event.quantity_change > 0 ? 'text-emerald-600' : event.quantity_change < 0 ? 'text-rose-600' : ''}`}>
              {event.quantity_change > 0 && <span className="mr-1">↑</span>}
              {event.quantity_change < 0 && <span className="mr-1">↓</span>}
              {event.quantity_change > 0 ? '+' : ''}{event.quantity_change}
            </div>
          </div>
          <div>
            <div className="text-text-secondary mb-1">Unit Cost</div>
            <div className="font-medium">{formatNumber(event.unit_cost)} VND</div>
          </div>
          
          {event.stock_ledger_id && (
            <div>
              <div className="text-text-secondary mb-1">Stock Ledger ID</div>
              <div className="font-medium">{event.stock_ledger_id}</div>
            </div>
          )}

          {event.reviewed_by && (
            <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-border">
              <div className="text-text-secondary mb-1">Review Info</div>
              <div className="font-medium">
                Người duyệt: {event.reviewed_by} vào {formatDateTime(event.reviewed_at)}
              </div>
              {event.notes && <div className="mt-1 text-text-primary italic">Lý do: {event.notes}</div>}
              {event.recompute_run_id && (
                <div className="mt-1 text-emerald-600">
                  Đã tính lại: {plan?.affected_lines?.length || 0} order lines, total delta {formatNumber(totalDeltaVnd)} VND (Run ID: {event.recompute_run_id})
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {event.status === "PENDING" && (
        <div className="flex gap-4">
          <button
            onClick={() => setShowApplyModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Duyệt + Tính lại COGS
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            className="px-4 py-2 bg-surface-card text-text-primary border border-border rounded-md font-medium text-sm hover:bg-page transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Từ chối
          </button>
        </div>
      )}

      {/* Affected Lines */}
      {plan && (
        <div className="bg-surface-card rounded-lg shadow border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-medium text-text-primary">Order lines bị ảnh hưởng</h3>
          </div>
          <div className="p-0">
            <AffectedLinesTable lines={plan.affected_lines} changes={plan.changes} />
          </div>
        </div>
      )}

      {/* Modals */}
      {showApplyModal && (
        <ApplyModal
          eventId={event.id}
          affectedLineCount={plan?.affected_lines?.length || 0}
          totalDeltaVnd={totalDeltaVnd}
          onConfirm={handleApprove}
          onCancel={() => setShowApplyModal(false)}
        />
      )}
      
      {showRejectModal && (
        <RejectModal
          eventId={event.id}
          onConfirm={handleReject}
          onCancel={() => setShowRejectModal(false)}
        />
      )}
    </div>
  );
}
