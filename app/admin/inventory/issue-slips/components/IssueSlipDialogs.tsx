"use client";

import { Button } from "@/components/ui/Button";

export interface IssueSlipDialogsProps {
  isOpen: boolean;
  cancelHref: string;
  onClose: () => void;
}

export function IssueSlipDialogs({
  isOpen,
  cancelHref,
  onClose,
}: IssueSlipDialogsProps) {
  if (!isOpen) return null;

  return (
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
          <Button variant="danger" href={cancelHref}>
            Có
          </Button>
        </div>
      </div>
    </div>
  );
}
