"use client";

import { useState } from "react";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { deleteAssetBand } from "../actions";
import { formatBandRange } from "@/lib/asset-depreciation";
import type { DBAssetDepreciationBand } from "@/types/db";

// 2026-08-23, section 2: hard delete, not soft -- assets.term_months is
// frozen at creation and carries no reference back to the band that
// produced it, so nothing depends on this row continuing to exist.
// deleteAssetBand itself refuses (via validateBands) a delete that would
// open a gap or leave the low/high end of the price line uncovered; this
// component just surfaces whatever it says.
export function DeleteBandButton({ band }: { band: DBAssetDepreciationBand }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    const formData = new FormData();
    formData.set("id", band.id);
    const res = await deleteAssetBand(formData);
    if (res.error) setError(res.error);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-danger hover:text-danger-active font-medium text-sm min-h-[44px] px-2"
      >
        Xoá
      </button>
      {error && (
        <div role="alert" aria-live="polite" className="mt-2 p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
          {error}
        </div>
      )}
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title="Xoá khung khấu hao"
        description={`Xoá khung "${formatBandRange(band)}"? Hành động này không thể hoàn tác.`}
      />
    </>
  );
}
