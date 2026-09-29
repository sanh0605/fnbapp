"use client";

import { useEffect, useRef, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { NAV_GROUPS } from "../nav-items";
import { X } from "lucide-react";

export function MoreSheet({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mouseDownTarget = useRef<EventTarget | null>(null);

  const initialPathname = useRef(pathname);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Close on route change
  useEffect(() => {
    if (pathname !== initialPathname.current) {
      onCloseRef.current();
    }
  }, [pathname]);

  // Handle focus, Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const container = containerRef.current;
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
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        containerRef.current.focus();
      }
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end"
      onMouseDown={(e) => {
        mouseDownTarget.current = e.target;
      }}
      onClick={(e) => {
        if (
          e.target === e.currentTarget &&
          mouseDownTarget.current === e.currentTarget
        ) {
          onClose();
        }
        mouseDownTarget.current = null;
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-surface-card rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 pb-8 flex flex-col gap-4 animate-slide-up outline-none"
      >
        <div className="flex justify-between items-center">
          <span id={titleId} className="text-lg font-bold text-text-primary">Tất cả mục</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-11 h-11 border-0 rounded-full bg-surface-card flex items-center justify-center text-text-primary text-xl cursor-pointer hover:bg-surface-card/10"
          >
            <X size={20} />
          </button>
        </div>

        {NAV_GROUPS.map((group) => {
          if (!group.children || group.children.length === 0) return null;
          const items = group.children;

          return (
            <div key={group.name} className="flex flex-col gap-2">
              <div className="text-[13px] font-bold text-text-muted">{group.name}</div>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center min-h-[44px] px-3.5 border border-border rounded-lg text-sm text-text-primary no-underline hover:bg-surface-card/10"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-2 border-t border-border pt-4 flex flex-col gap-2">
          <div className="text-[13px] font-bold text-text-muted">Tài khoản</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 min-h-[44px] px-3.5 border border-border rounded-lg text-sm text-text-primary">
              <span className="font-medium">{session?.user?.name || "Admin User"}</span>
              <span className="text-text-muted capitalize">({(session?.user as any)?.role || "Admin"})</span>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center min-h-[44px] px-4 border border-border rounded-lg text-sm text-text-primary bg-surface-card cursor-pointer hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
