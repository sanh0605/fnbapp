"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export interface IssueSlipDialogsProps {
  dialog: "cancel" | "empty" | null;
  slipId: string;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onClose: () => void;
  onAskReason: () => void;
  onConfirmCancel: () => void;
}

export function IssueSlipDialogs({
  dialog,
  slipId,
  reason,
  onReasonChange,
  isPending,
  onClose,
  onAskReason,
  onConfirmCancel,
}: IssueSlipDialogsProps): JSX.Element {
  return (
    <>
      {dialog === "empty" && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-label="Phiếu không còn dòng"
            className="w-full max-w-md p-6 rounded-2xl bg-surface-card flex flex-col gap-4 shadow-lg"
          >
            <h2 className="m-0 text-xl font-bold text-text-primary">
              Phiếu không còn dòng nào. Huỷ phiếu này?
            </h2>
            <div className="flex justify-end gap-2.5 mt-2">
              <Button variant="secondary" onClick={onClose}>
                Không
              </Button>
              <Button variant="danger" onClick={onAskReason}>
                Có
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog === "cancel" && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-label="Huỷ phiếu"
            className="w-full max-w-md p-6 rounded-2xl bg-surface-card flex flex-col gap-4 shadow-lg"
          >
            <h2 className="m-0 text-xl font-bold text-text-primary">Huỷ phiếu {slipId}?</h2>
            <p className="m-0 text-sm text-text-secondary leading-relaxed">
              Toàn bộ các dòng còn hiệu lực được trả về kho hôm nay. Phiếu sẽ ẩn khỏi danh sách;
              chọn Loại = "Đã huỷ" để xem lại.
            </p>
            <Field label="Lý do huỷ" htmlFor="cancel-reason" required>
              <textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                rows={3}
                placeholder="Ví dụ: ghi nhầm, hàng chưa dùng"
                className="w-full p-2.5 border border-border rounded-lg text-sm font-normal resize-none outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
              />
            </Field>
            <div className="flex justify-end gap-2.5 mt-2">
              <Button variant="secondary" onClick={onClose} disabled={isPending}>
                Quay lại
              </Button>
              <Button
                variant="danger"
                onClick={onConfirmCancel}
                disabled={!reason.trim() || isPending}
                loading={isPending}
              >
                Huỷ phiếu
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
