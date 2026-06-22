"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getBrands } from "@/app/admin/brands/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const navItems = [
    { name: "Tổng quan", href: "/admin", icon: "📊" },
    { name: "Thương hiệu", href: "/admin/brands", icon: "🏢" },
    { 
      name: "Hàng hoá", 
      icon: "📦",
      children: [
        { name: "Nhà cung cấp", href: "/admin/suppliers" },
        { name: "Phân Loại Hàng", href: "/admin/inventory/categories" },
        { name: "Nhóm Nguyên Liệu", href: "/admin/inventory/base-ingredients" },
        { name: "Hàng Mua Vào", href: "/admin/inventory/items" },
        { name: "Bảng Quy Đổi", href: "/admin/inventory/conversions" },
        { name: "Quản lý Đơn vị", href: "/admin/inventory/units" },
        { name: "Nhập Hàng", href: "/admin/inventory/purchase-orders" },
      ]
    },
    { 
      name: "Bán thành phẩm", 
      icon: "🥣",
      children: [
        { name: "Cấu hình / Công thức", href: "/admin/semi-products" },
        { name: "Sản xuất / Nấu Bếp", href: "/admin/production" },
      ]
    },
    { 
      name: "Thành phẩm (Menu)", 
      icon: "☕",
      children: [
        { name: "Danh mục Nhóm", href: "/admin/products/categories" },
        { name: "Danh sách Món", href: "/admin/products" },
        { name: "Tuỳ chọn (Topping)", href: "/admin/products/modifiers" },
      ]
    },
    { name: "Nhân sự & Phân quyền", href: "/admin/users", icon: "👥" },
    { name: "Quản lý Đơn hàng", href: "/admin/orders", icon: "🧾" },
    { name: "Khuyến mãi", href: "/admin/promotions", icon: "🏷️" },
    { 
      name: "Báo cáo & Phân tích", 
      icon: "📈",
      children: [
        { name: "Báo cáo Bán hàng", href: "/admin/reports/sales" },
        { name: "Báo cáo Lãi lỗ", href: "/admin/reports/pnl" },
        { name: "Báo cáo Tồn kho", href: "/admin/reports/stock" },
      ]
    },
  ];

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const router = useRouter();

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "Hàng hoá Đầu vào": pathname.includes("/admin/inventory") && !pathname.includes("/purchase-orders"),
    "Bán thành phẩm": pathname.includes("/admin/semi-products") || pathname.includes("/admin/production"),
    "Thành phẩm (Menu)": pathname.includes("/admin/products"),
    "Báo cáo & Phân tích": pathname.includes("/admin/reports"),
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

  // Automatically expand group if active
  useEffect(() => {
    setExpandedGroups(prev => ({
      ...prev,
      "Hàng hoá Đầu vào": prev["Hàng hoá Đầu vào"] || (pathname.includes("/admin/inventory") && !pathname.includes("/purchase-orders")),
      "Bán thành phẩm": prev["Bán thành phẩm"] || pathname.includes("/admin/semi-products") || pathname.includes("/admin/production"),
      "Thành phẩm (Menu)": prev["Thành phẩm (Menu)"] || pathname.includes("/admin/products"),
      "Báo cáo & Phân tích": prev["Báo cáo & Phân tích"] || pathname.includes("/admin/reports"),
    }));
  }, [pathname]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
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
        className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
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

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item: any) => {
            if (item.children) {
              const isGroupActive = item.children.some((child: any) => pathname === child.href);
              const isExpanded = !!expandedGroups[item.name];
              
              return (
                <div key={item.name} className="space-y-1 mb-1">
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isGroupActive ? "text-blue-700 bg-blue-50/50" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
                            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                              isChildActive
                                ? "bg-blue-50 text-blue-700 font-bold"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium"
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
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 mb-1 ${
                  isActive
                    ? "bg-blue-50 text-blue-700 shadow-sm font-semibold"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium"
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
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-bold text-gray-900">Admin</span>
          <div className="w-10"></div>
        </div>

        {/* Content Scroll */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full pb-20">
            {children}
          </div>
        </div>
      </main>

      {/* POS Brand Selection Modal */}
      {isPosModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Chọn thương hiệu</h3>
              <button 
                onClick={() => setIsPosModalOpen(false)} 
                className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 bg-white space-y-3">
              <p className="text-sm text-gray-500 mb-4 text-center">
                Mở máy POS để bắt đầu bán hàng cho thương hiệu nào?
              </p>
              
              {brands.length === 0 ? (
                <div className="text-center text-gray-400 py-4 animate-pulse">Đang tải danh sách...</div>
              ) : (
                brands.map(brand => (
                  <button 
                    key={brand.id}
                    onClick={() => selectBrandForPos(brand.id)}
                    className="w-full bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold text-lg py-4 rounded-xl hover:bg-blue-100 hover:border-blue-300 active:scale-[0.98] transition-all flex justify-center items-center gap-3"
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
