"use client";

import { isOutletOpenAt } from "@/lib/outlet-hours";
import { confirm } from "@/lib/dialog";
import { Store } from "lucide-react";

interface PickerOutlet {
  id: string;
  name: string;
  open_time?: string | null;
  close_time?: string | null;
}

interface PosOutletPickerProps {
  outlets: PickerOutlet[];
  // The Saigon "HH:MM" snapshotted when the picker opened -- see
  // lib/outlet-hours.ts's getSaigonNowHHMM.
  nowHHMM: string;
  onOpenTill: (outletId: string) => void;
}

// section 2:
// confirms before opening a till at an outlet outside its stated hours --
// does not block it, since the shop may genuinely trade late. Picking the
// wrong outlet books revenue against the wrong one, which the per-outlet
// breakdown exists to compare. Extracted out of app/admin/layout.tsx so
// this flow is render-testable without next-auth/next-navigation mocking
// (layout.tsx's useSession/usePathname/useRouter have no test precedent in
// this repo) -- the same reason OutletsList was extracted from an async
// Server Component.
export function PosOutletPicker({ outlets, nowHHMM, onOpenTill }: PosOutletPickerProps) {
  async function handleSelect(outlet: PickerOutlet) {
    const isOpen = isOutletOpenAt(outlet.open_time, outlet.close_time, nowHHMM);
    if (!isOpen) {
      const approved = await confirm({
        title: "Điểm bán ngoài giờ hoạt động",
        message: `"${outlet.name}" hiện ngoài giờ mở cửa đã đặt. Vẫn mở máy POS tại đây?`,
        okText: "Vẫn mở máy",
        cancelText: "Huỷ",
        variant: "warning",
      });
      if (!approved) return;
    }
    onOpenTill(outlet.id);
  }

  return (
    <>
      {outlets.map(outlet => {
        const isOpen = isOutletOpenAt(outlet.open_time, outlet.close_time, nowHHMM);
        const hasStatedHours = !!(outlet.open_time && outlet.close_time);
        return (
          <button
            key={outlet.id}
            onClick={() => void handleSelect(outlet)}
            className="w-full bg-primary text-white border border-primary font-bold text-lg py-4 rounded-button hover:bg-primary-hover active:bg-primary-active active:scale-[0.98] transition-colors flex flex-col items-center gap-1 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
          >
            <span className="flex items-center gap-3">
              <Store size={24} />
              <span>{outlet.name}</span>
            </span>
            {hasStatedHours && (
              <span className={`text-xs font-medium ${isOpen ? "text-white/80" : "text-warning"}`}>
                {isOpen ? "Đang trong giờ mở cửa" : "Ngoài giờ mở cửa"}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
