"use client";

import { useState } from "react";
import { FormModal } from "./FormModal";
import { Button } from "./Button";
import { AlertTriangle } from "lucide-react";

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
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-50 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-danger" />
        </div>
        <p className="text-text-secondary text-sm">{description}</p>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="secondary" onClick={onClose}>Huỷ</Button>
        <Button variant="danger" loading={loading} onClick={handleConfirm}>Xoá</Button>
      </div>
    </FormModal>
  );
}
