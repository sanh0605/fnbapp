"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useId } from "react";
import { getOutlets } from "@/app/admin/outlets/actions";
import { getSaigonNowHHMM } from "@/lib/catalog/outlet-hours";
import { PosOutletPicker } from "@/app/admin/components/PosOutletPicker";
import { AdminSidebar } from "./components/AdminSidebar";
import { PhoneNavBar } from "./components/PhoneNavBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [outletsLoading, setOutletsLoading] = useState(false);
  const [outletsError, setOutletsError] = useState<string | null>(null);
  // Snapshotted once when the picker opens (plan section 2), not a ticking
  // clock -- the picker is on screen for seconds, not hours.
  const [nowHHMM, setNowHHMM] = useState("");
  const router = useRouter();

  const posModalTitleId = useId();
  const posModalContainerRef = useRef<HTMLDivElement>(null);
  const posModalMouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!isPosModalOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setIsPosModalOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const container = posModalContainerRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([aria-hidden="true"]), ' +
        '[href]:not([aria-hidden="true"]), ' +
        'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"]), ' +
        'select:not([disabled]):not([aria-hidden="true"]), ' +
        'textarea:not([disabled]):not([aria-hidden="true"]), ' +
        '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    const previouslyFocused = document.activeElement as HTMLElement | null;
    queueMicrotask(() => {
      if (
        posModalContainerRef.current &&
        !posModalContainerRef.current.contains(document.activeElement)
      ) {
        posModalContainerRef.current.focus();
      }
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isPosModalOpen]);

  const loadOutletsForPosModal = async () => {
    setOutletsLoading(true);
    setOutletsError(null);
    try {
      const fetchedOutlets = await getOutlets();
      setOutlets(fetchedOutlets);
      setNowHHMM(getSaigonNowHHMM());
    } catch {
      setOutletsError("Không tải được danh sách điểm bán. Vui lòng thử lại.");
    } finally {
      setOutletsLoading(false);
    }
  };

  const handleOpenPosModal = () => {
    setIsPosModalOpen(true);
    void loadOutletsForPosModal();
  };

  const openTillAtOutlet = (outletId: string) => {
    setIsPosModalOpen(false);
    router.push(`/pos?outletId=${outletId}`);
  };

  return (
    <div className="fixed inset-0 flex bg-page font-sans text-text-primary overflow-hidden">
      
      {/* Sidebar */}
      <AdminSidebar onOpenPos={handleOpenPosModal} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-surface-card/50 relative">
        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1920px] mx-auto w-full pb-24 md:pb-0">
            {children}
          </div>
        </div>
      </main>

      {/* Phone Navigation Bar */}
      <PhoneNavBar onOpenPos={handleOpenPosModal} />

      {/* POS Brand Selection Modal */}
      {isPosModalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overscroll-behavior-contain"
          onMouseDown={(e) => {
            posModalMouseDownTarget.current = e.target;
          }}
          onClick={(e) => {
            if (
              e.target === e.currentTarget &&
              posModalMouseDownTarget.current === e.currentTarget
            ) {
              setIsPosModalOpen(false);
            }
            posModalMouseDownTarget.current = null;
          }}
        >
          <div 
            ref={posModalContainerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={posModalTitleId}
            tabIndex={-1}
            className="bg-surface-card w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up outline-none"
          >
            <div className="p-5 border-b border-border flex justify-between items-center bg-surface-secondary">
              <h3 id={posModalTitleId} className="text-xl font-bold text-text-primary">Chọn điểm bán</h3>
              <button 
                onClick={() => setIsPosModalOpen(false)} 
                className="p-1.5 bg-surface-secondary rounded-full text-text-muted hover:bg-border focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none"
                aria-label="Đóng"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 bg-surface-card space-y-3">
              <p className="text-sm text-text-muted mb-4 text-center">
                Mở máy POS để bắt đầu bán hàng tại điểm bán nào?
              </p>

              {outletsError ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-sm text-danger">{outletsError}</p>
                  <button
                    onClick={() => void loadOutletsForPosModal()}
                    className="px-4 py-2 text-sm font-medium text-on-primary bg-primary rounded-button hover:bg-primary-hover transition-colors"
                  >
                    Thử lại
                  </button>
                </div>
              ) : outletsLoading || outlets.length === 0 ? (
                <div className="text-center text-text-muted py-4 animate-pulse">Đang tải danh sách…</div>
              ) : (
                <PosOutletPicker outlets={outlets} nowHHMM={nowHHMM} onOpenTill={openTillAtOutlet} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
