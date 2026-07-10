"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/format";

interface ApplyModalProps {
  eventId: string;
  affectedLineCount: number;
  totalDeltaVnd: number;
  onConfirm: (reviewer: string) => Promise<void>;
  onCancel: () => void;
}

export function ApplyModal({
  eventId,
  affectedLineCount,
  totalDeltaVnd,
  onConfirm,
  onCancel,
}: ApplyModalProps) {
  const [reviewer, setReviewer] = useState("admin"); // Placeholder
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reviewer);
    } catch (err: any) {
      setError(err.message || String(err));
      setLoading(false);
    }
  };

  return (
    <FormModal
      isOpen={true}
      onClose={onCancel}
      title="Xác nhận tính lại COGS"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 py-2">
        <p className="text-sm text-gray-600">
          Hành động này sẽ cập nhật COGS cho <strong>{affectedLineCount}</strong> order lines, tổng chênh lệch <strong>{formatNumber(totalDeltaVnd)} VND</strong>. Không thể hoàn tác.
        </p>
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
          loadingText="Đang tính lại..."
          onClick={handleConfirm}
          variant="danger"
        >
          Xác nhận
        </LoadingButton>
      </div>
    </FormModal>
  );
}
