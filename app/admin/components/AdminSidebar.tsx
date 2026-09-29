"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { NAV_GROUPS } from "../nav-items";
import { readSidebarCollapsed, writeSidebarCollapsed, activeGroupName, activeChildHref } from "./sidebar-state";
import { ChevronLeft, ChevronRight, Store, ChevronDown } from "lucide-react";

export function AdminSidebar({ onOpenPos }: { onOpenPos: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(() => activeGroupName(pathname));

  useEffect(() => {
    const isCollapsed = readSidebarCollapsed(() => window.localStorage);
    setCollapsed(isCollapsed);
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setOpenGroup(activeGroupName(pathname));
    }
  }, [pathname]);

  const toggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    writeSidebarCollapsed(() => window.localStorage, newCollapsed);
  };

  const toggleGroup = (name: string) => {
    setOpenGroup(prev => (prev === name ? null : name));
  };

  const handleGroupClick = (groupName: string) => {
    if (collapsed) {
      setCollapsed(false);
      writeSidebarCollapsed(() => window.localStorage, false);
      setOpenGroup(groupName);
    } else {
      toggleGroup(groupName);
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-surface-card border-r border-border h-full flex-shrink-0 transition-[width] duration-300 ease-in-out p-4 gap-3 ${
        collapsed ? "w-[76px]" : "w-[272px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2 h-10 px-1">
        {!collapsed && (
          <span className="text-lg font-bold text-primary">fnbapp</span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          className="w-10 h-10 flex items-center justify-center border border-border rounded-lg bg-surface-card text-text-muted hover:bg-surface-card/80 cursor-pointer"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <button
        type="button"
        title="Mở máy bán hàng"
        aria-label="Mở máy bán hàng"
        onClick={onOpenPos}
        className="flex items-center justify-center gap-2.5 w-full min-h-[48px] border-0 rounded-lg bg-text-primary text-white font-bold text-[15px] cursor-pointer shadow-sm flex-shrink-0"
      >
        <Store size={20} />
        {!collapsed && <span>Mở máy bán hàng</span>}
      </button>

      <nav aria-label="Menu chính" className="flex flex-col gap-0.5 flex-grow overflow-y-auto sidebar-nav-scroll">
        {NAV_GROUPS.map(group => {
          const Icon = group.icon;
          const isGroupActive = activeGroupName(pathname) === group.name;
          const isExpanded = openGroup === group.name && !collapsed;

          if (group.href) {
            const isActive = pathname === group.href;
            return (
              <Link
                key={group.name}
                href={group.href}
                title={group.name}
                className={`flex items-center gap-3 w-full box-border min-h-[44px] px-3 py-2.5 border-0 rounded-lg text-[15px] font-semibold cursor-pointer text-left no-underline ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-primary-soft text-primary"
                    : "bg-transparent text-text-primary hover:bg-surface-card/10"
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && <span className="flex-grow">{group.name}</span>}
              </Link>
            );
          }

          return (
            <div key={group.name}>
              <button
                type="button"
                title={group.name}
                onClick={() => handleGroupClick(group.name)}
                className={`flex items-center gap-3 w-full box-border min-h-[44px] px-3 py-2.5 border-0 rounded-lg text-[15px] font-semibold cursor-pointer text-left no-underline ${
                  collapsed ? "justify-center" : ""
                } ${
                  collapsed && isGroupActive
                    ? "bg-primary-soft text-primary"
                    : "bg-transparent text-text-primary hover:bg-surface-card/10"
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-grow">{group.name}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </>
                )}
              </button>
              {isExpanded && group.children && (
                <div className="flex flex-col gap-0.5 py-0.5 pb-1.5">
                  {(() => {
                    const activeHref = activeChildHref(pathname, group.children);
                    return group.children.map(child => {
                      const isChildActive = child.href === activeHref;
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={`block py-2 pr-3 pl-11 rounded-lg text-sm no-underline ${
                            isChildActive
                              ? "bg-primary-soft text-primary font-semibold"
                              : "text-text-muted hover:text-text-primary"
                          }`}
                        >
                          {child.name}
                        </Link>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border pt-3 flex items-center gap-2.5 flex-shrink-0">
        <div className="w-9 h-9 flex-shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold">
          {session?.user?.name?.charAt(0).toUpperCase() || "A"}
        </div>
        {!collapsed && (
          <>
            <div className="flex-grow text-[13px] leading-[1.3]">
              <div className="font-semibold text-text-primary truncate">{session?.user?.name || "Admin User"}</div>
              <div className="text-text-muted truncate capitalize">{(session?.user as any)?.role || "Admin"}</div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="border border-border bg-surface-card text-text-muted rounded-lg py-2 px-2.5 text-[13px] cursor-pointer hover:bg-border/50"
            >
              Đăng xuất
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
