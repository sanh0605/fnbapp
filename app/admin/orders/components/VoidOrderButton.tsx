"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertCircle, X } from "lucide-react";
import { voidOrderV2 } from "@/app/admin/orders/actions";

interface VoidOrderButtonProps {
  orderId: string;
  orderNo: string;
  disabled?: boolean;
  onVoided?: () => void;
  variant?: "ghost" | "secondary" | "primary";
  className?: string;
}

export function VoidOrderButton({
  orderId,
  orderNo,
  disabled,
  onVoided,
  variant = "ghost",
  className = "",
}: VoidOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setVoidReason("");
    setVoidError(null);
  };

  const confirmVoid = async () => {
    setVoidError(null);
    if (!voidReason.trim()) return;
    setIsSubmitting(true);
    const res = await voidOrderV2(orderId, voidReason.trim());
    setIsSubmitting(false);
    if (!res.success) {
      setVoidError("Lỗi hủy đơn: " + res.error);
      return;
    }
    setIsOpen(false);
    setVoidReason("");
    onVoided?.();
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={`!text-danger hover:!bg-danger/10 min-h-[44px] ${className}`}
        onClick={handleOpen}
        disabled={disabled}
      >
        Hủy đơn
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-surface-card w-full max-w-sm rounded-card shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border bg-danger/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-danger">Hủy đơn hàng</h3>
                <p className="text-sm text-danger font-medium">{orderNo}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-text-secondary text-sm">
                Đơn sẽ chuyển sang trạng thái VOIDED. Nguyên liệu sẽ được hoàn trả vào kho. Lịch sử đơn được giữ nguyên.
              </p>
              {voidError && (
                <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/30 flex justify-between">
                  <span>{voidError}</span>
                  <button
                    type="button"
                    onClick={() => setVoidError(null)}
                    className="ml-2 text-danger hover:opacity-80"
                    aria-label="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <textarea
                aria-label="Lý do hủy đơn"
                placeholder="Lý do hủy đơn (bắt buộc)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
              />
            </div>
            <div className="p-4 border-t border-border bg-page flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1 min-h-[44px]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1 !bg-danger hover:!bg-danger/90 min-h-[44px]"
                onClick={confirmVoid}
                disabled={!voidReason.trim() || isSubmitting}
              >
                {isSubmitting ? "Đang hủy..." : "Đồng ý hủy"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
