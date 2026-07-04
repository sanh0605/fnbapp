"use client";

import { useState } from "react";
import { FormModal } from "./FormModal";
import { LoadingButton } from "./LoadingButton";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description?: string;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Xác nhận xoá",
  description = "Hành động này không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?",
}: DeleteConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  }

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-sm"
    >
      <div className="text-center py-2">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
        >
          Huỷ
        </button>
        <LoadingButton
          loading={loading}
          loadingText="Đang xoá…"
          onClick={handleConfirm}
          variant="danger"
        >
          Xoá
        </LoadingButton>
      </div>
    </FormModal>
  );
}
