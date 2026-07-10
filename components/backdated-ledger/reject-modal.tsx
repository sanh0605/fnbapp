"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";

interface RejectModalProps {
  eventId: string;
  onConfirm: (reason: string, reviewer: string) => Promise<void>;
  onCancel: () => void;
}

export function RejectModal({ eventId, onConfirm, onCancel }: RejectModalProps) {
  const [reason, setReason] = useState("");
  const [reviewer, setReviewer] = useState("admin"); // Placeholder
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (reason.length < 10) {
      setError("Lý do phải có ít nhất 10 ký tự");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason, reviewer);
    } catch (err: any) {
      setError(err.message || String(err));
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={true}
      onClose={onCancel}
      title="Từ chối tính lại"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 py-2">
        <p className="text-sm text-gray-600">
          Đánh dấu giao dịch này là không cần tính lại. Lý do:
        </p>
        <div>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Nhập lý do từ chối (ít nhất 10 ký tự)..."
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Người duyệt</label>
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            readOnly
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          Hủy
        </button>
        <LoadingButton
          loading={loading}
          loadingText="Đang xử lý..."
          onClick={handleConfirm}
          disabled={reason.length < 10}
        >
          Từ chối
        </LoadingButton>
      </div>
    </FormModal>
  );
}
