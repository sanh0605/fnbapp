"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useId } from "react";
import { getBrands } from "@/app/admin/brands/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navItems = [
    { name: "Tổng quan", href: "/admin", icon: "📊" },
    {
      name: "Danh mục",
      icon: "📦",
      children: [
        { name: "Thương hiệu", href: "/admin/brands" },
        { name: "Nhà cung cấp", href: "/admin/suppliers" },
        { name: "Phân loại Hàng", href: "/admin/inventory/categories" },
        { name: "Nhóm Nguyên Liệu", href: "/admin/inventory/base-ingredients" },
        { name: "Hàng Mua Vào", href: "/admin/inventory/items" },
        { name: "Bảng Quy Đổi", href: "/admin/inventory/conversions" },
        { name: "Quản lý Đơn vị", href: "/admin/inventory/units" },
      ]
    },
    {
      name: "Nhập hàng & Tồn kho",
      icon: "🚚",
      children: [
        { name: "Đơn Nhập Hàng", href: "/admin/inventory/purchase-orders" },
        { name: "Điều chỉnh Tồn kho", href: "/admin/inventory/stock-adjustments" },
        { name: "Đồng bộ Tồn kho", href: "/admin/inventory/sync" },
        { name: "Nhập hàng chờ duyệt", href: "/admin/audit/backdated-ledger" },
      ]
    },
    {
      name: "Sản xuất",
      icon: "🥣",
      children: [
        { name: "Công thức Bán thành phẩm", href: "/admin/semi-products" },
        { name: "Sản xuất / Nấu Bếp", href: "/admin/production" },
      ]
    },
    {
      name: "Menu Bán hàng",
      icon: "☕",
      children: [
        { name: "Danh mục Nhóm", href: "/admin/products/categories" },
        { name: "Danh sách Món", href: "/admin/products" },
        { name: "Topping & Tùy chọn", href: "/admin/products/modifiers" },
        { name: "Topping Độc Lập", href: "/admin/products/toppings" },
        { name: "Dự toán Giá vốn", href: "/admin/products/cogs-estimate" },
      ]
    },
    {
      name: "Bán hàng",
      icon: "🧾",
      children: [
        { name: "Đơn hàng", href: "/admin/orders" },
        { name: "Khuyến mãi", href: "/admin/promotions" },
      ]
    },
    {
      name: "Báo cáo",
      icon: "📈",
      children: [
        { name: "Báo cáo Bán hàng", href: "/admin/reports/sales" },
        { name: "Báo cáo Lãi lỗ", href: "/admin/reports/pnl" },
        { name: "Báo cáo Tồn kho", href: "/admin/reports/stock" },
      ]
    },
    {
      name: "Hệ thống",
      icon: "⚙️",
      children: [
        { name: "Nhân sự & Phân quyền", href: "/admin/users" },
        { name: "Nhật ký Hoạt động", href: "/admin/activity-log" },
        { name: "Sao lưu & Đồng bộ", href: "/admin/backup" },
        { name: "Xoá Cache", href: "/admin/clear-cache" },
      ]
    }
  ];

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
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

  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    for (const item of navItems) {
      if (item.children?.some((child: any) => pathname === child.href)) {
        return item.name;
      }
    }
    return null;
  });

  const handleOpenPosModal = async () => {
    setIsPosModalOpen(true);
    const fetchedBrands = await getBrands();
    setBrands(fetchedBrands);
  };

  const selectBrandForPos = (brandId: string) => {
    setIsPosModalOpen(false);
    router.push(`/pos?brandId=${brandId}`);
  };

  useEffect(() => {
    for (const item of navItems) {
      if (item.children?.some((child: any) => pathname === child.href)) {
        setOpenGroup(item.name);
        return;
      }
    }
  }, [pathname]);

  const toggleGroup = (name: string) => {
    setOpenGroup(prev => prev === name ? null : name);
  };

  return (
    <div className="fixed inset-0 flex bg-gray-50 font-sans text-gray-900 overflow-hidden">
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[49] md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 w-64 bg-white/95 border-r border-gray-200/80 backdrop-blur-md flex flex-col shadow-sm z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 pt-[env(safe-area-inset-top)] md:pt-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Admin Workspace
          </h1>
          <button 
            className="md:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>
        </div>
        
        <div className="px-4 py-3 border-b border-gray-100">
          <button 
            onClick={handleOpenPosModal}
            className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-2.5 rounded-lg hover:bg-orange-700 transition shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            MỞ MÁY POS
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 sidebar-nav-scroll">
          {navItems.map((item: any) => {
            if (item.children) {
              const isGroupActive = item.children.some((child: any) => pathname === child.href);
              const isExpanded = openGroup === item.name;
              
              return (
                <div key={item.name} className="space-y-1 mb-1">
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isGroupActive ? "text-blue-700 bg-blue-50/50 font-semibold" : "text-gray-600 hover:bg-blue-50/40 hover:text-blue-700"
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="mr-3 text-lg">{item.icon}</span>
                      {item.name}
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-90 text-blue-600" : "text-gray-400"}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {isExpanded && (
                    <div className="pl-11 space-y-1 mt-1">
                      {item.children.map((child: any) => {
                        const isChildActive = pathname === child.href;
                        return (
                          <Link
                            key={child.name}
                            href={child.href}
                            prefetch={false}
                            onClick={() => setIsSidebarOpen(false)}
                            className={`block px-3 py-2 rounded-lg text-sm transition-colors duration-200 ${
                              isChildActive
                                ? "bg-blue-50 text-blue-700 font-semibold shadow-sm"
                                : "text-gray-500 hover:bg-blue-50/40 hover:text-blue-700 font-medium"
                            }`}
                          >
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href) && !pathname.includes("/admin/products") && !pathname.includes("/admin/semi-products") && !pathname.includes("/admin/production"));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                prefetch={false}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 mb-1 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm font-semibold"
                    : "text-gray-600 hover:bg-blue-50/40 hover:text-blue-700 font-medium"
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              {session?.user?.name?.charAt(0).toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session?.user?.name || "Admin User"}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {(session?.user as any)?.role || "Admin"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white/50 relative">
        {/* Top Header Mobile */}
        <div className="md:hidden h-auto min-h-[4rem] bg-white border-b border-gray-200 flex items-center px-4 justify-between pt-[env(safe-area-inset-top)]">
          <button 
            className="text-gray-500 p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-bold text-gray-900">Admin</span>
          <div className="w-10"></div>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1920px] mx-auto w-full pb-20">
            {children}
          </div>
        </div>
      </main>

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
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up outline-none"
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 id={posModalTitleId} className="text-xl font-bold text-gray-900">Chọn thương hiệu</h3>
              <button 
                onClick={() => setIsPosModalOpen(false)} 
                className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                aria-label="Đóng"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 bg-white space-y-3">
              <p className="text-sm text-gray-500 mb-4 text-center">
                Mở máy POS để bắt đầu bán hàng cho thương hiệu nào?
              </p>
              
              {brands.length === 0 ? (
                <div className="text-center text-gray-400 py-4 animate-pulse">Đang tải danh sách…</div>
              ) : (
                brands.map(brand => (
                  <button 
                    key={brand.id}
                    onClick={() => selectBrandForPos(brand.id)}
                    className="w-full bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold text-lg py-4 rounded-xl hover:bg-blue-100 hover:border-blue-300 active:scale-[0.98] transition-colors flex justify-center items-center gap-3 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                  >
                    <span>🏢</span>
                    <span>{brand.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
