"use client";

import { isOutletOpenAt } from "@/lib/catalog/outlet-hours";
import { confirm } from "@/lib/shared/dialog";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface PickerOutlet {
  id: string;
  name: string;
  open_time?: string | null;
  close_time?: string | null;
}

interface PosOutletPickerProps {
  outlets: PickerOutlet[];
  // The Saigon "HH:MM" snapshotted when the picker opened -- see
  // lib/catalog/outlet-hours.ts's getSaigonNowHHMM.
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
// this repo) -- the same reason list clients are extracted from an async
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
          <Button
            key={outlet.id}
            variant="secondary"
            className="w-full flex-col"
            onClick={() => void handleSelect(outlet)}
          >
            <span className="flex items-center gap-3">
              <Store size={24} />
              <span>{outlet.name}</span>
            </span>
            {hasStatedHours && (
              <span className={`text-xs font-medium ${isOpen ? "text-success" : "text-warning"}`}>
                {isOpen ? "Đang trong giờ mở cửa" : "Ngoài giờ mở cửa"}
              </span>
            )}
          </Button>
        );
      })}
    </>
  );
}
