"use client";

import { useRouter } from "next/navigation";
import { PosOutletPicker } from "@/app/admin/components/PosOutletPicker";

// Shown to STAFF who open /pos without a valid outlet (they cannot reach /admin's picker).
export default function PosOutletChoice(props: {
  outlets: Array<{ id: string; name: string; open_time?: string | null; close_time?: string | null }>;
  nowHHMM: string;
}) {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary p-4 sm:p-6">
      <div className="w-full max-w-md bg-surface-card rounded-2xl shadow-xl border border-border p-6 sm:p-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Chọn điểm bán</h1>
          <p className="text-xs sm:text-sm text-text-secondary">
            Chọn điểm bán để bắt đầu ca bán hàng
          </p>
        </div>
        <div className="space-y-3">
          <PosOutletPicker {...props} onOpenTill={(id) => router.push(`/pos?outletId=${id}`)} />
        </div>
      </div>
    </div>
  );
}
