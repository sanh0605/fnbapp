"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Store } from "lucide-react";
import { NAV_GROUPS, PHONE_BAR_HREFS } from "../nav-items";
import { MoreSheet } from "./MoreSheet";
import { useState, useCallback } from "react";

function findNavInfo(targetHref: string) {
  for (const group of NAV_GROUPS) {
    if (group.href === targetHref) {
      return { name: group.name, icon: group.icon, href: group.href };
    }
    if (group.children) {
      const child = group.children.find(c => c.href === targetHref);
      if (child) {
        // Inherit icon from group, use child's name
        return { name: child.name, icon: group.icon, href: child.href };
      }
    }
  }
  return null;
}

export function PhoneNavBar({ onOpenPos }: { onOpenPos: () => void }) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const closeMore = useCallback(() => setIsMoreOpen(false), []);

  const slots = PHONE_BAR_HREFS.map(findNavInfo).filter(Boolean) as Array<{
    name: string;
    icon: any;
    href: string;
  }>;

  return (
    <>
      <nav
        aria-label="Menu chính"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 bg-surface-card border-t border-border pb-[env(safe-area-inset-bottom)] pt-1.5 px-1"
      >
        {slots.map((slot) => {
          const Icon = slot.icon;
          const isActive = pathname === slot.href || (slot.href !== "/admin" && pathname.startsWith(`${slot.href}/`));
          
          return (
            <Link
              key={slot.href}
              href={slot.href}
              className={`flex flex-col items-center justify-center gap-1 min-h-[52px] py-1 px-0.5 text-[11px] font-semibold no-underline text-center ${
                isActive ? "text-primary" : "text-text-muted"
              }`}
            >
              <Icon size={24} />
              <span className="truncate w-full">{slot.name}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          aria-expanded={isMoreOpen}
          className="flex flex-col items-center justify-center gap-1 min-h-[52px] py-1 px-0.5 text-[11px] font-semibold text-text-muted bg-transparent border-0 cursor-pointer"
        >
          <Menu size={24} />
          <span>Thêm</span>
        </button>

        <button
          type="button"
          onClick={onOpenPos}
          className="flex flex-col items-center justify-center gap-1 min-h-[52px] py-1 px-0.5 text-[11px] font-semibold text-text-primary bg-transparent border-0 cursor-pointer"
        >
          <div className="flex items-center justify-center w-12 h-12 -mt-[22px] rounded-full bg-text-primary text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
            <Store size={24} />
          </div>
          <span>Máy bán hàng</span>
        </button>
      </nav>

      {isMoreOpen && <MoreSheet onClose={closeMore} />}
    </>
  );
}
