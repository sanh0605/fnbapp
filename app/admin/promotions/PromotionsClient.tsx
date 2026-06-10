"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePromotion } from "@/app/actions/promotions";
import PromotionForm from "@/components/PromotionForm";

interface PromotionsClientProps {
  initialPromotions: any[];
  brands: any[];
  products: any[];
  variants: any[];
  categories: any[];
}

export default function PromotionsClient({
  initialPromotions,
  brands,
  products,
  variants,
  categories,
}: PromotionsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await deletePromotion(id);
    setDeletingId(null);
    setDeleteConfirmId(null);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Không thể xoá chương trình khuyến mãi.");
    }
  };

  const getBrandName = (brandId: string) => {
    if (!brandId) return "Toàn hệ thống";
    const brand = brands.find((b) => b.id === brandId);
    return brand ? brand.name : "Không xác định";
  };

  // Determine if a promotion is expired
  const isExpired = (endDate: string) => {
    if (!endDate) return false;
    return new Date(endDate).getTime() < new Date().getTime();
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const HH = String(d.getHours()).padStart(2, '0');
    const MIN = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${HH}:${MIN}:${SS}`;
  };

  // Filter promotions
  const filteredPromotions = initialPromotions.filter((promo) => {
    // Search filter
    const matchesSearch =
      promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (promo.code && promo.code.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Status filter
    const expired = isExpired(promo.end_date);
    if (activeTab === "ACTIVE") {
      return promo.status === "ACTIVE" && !expired;
    }
    if (activeTab === "INACTIVE") {
      return promo.status === "INACTIVE" || expired;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Khuyến mãi & Ưu đãi</h1>
          <p className="text-gray-500 mt-1">Quản lý mã giảm giá, chiết khấu hóa đơn và khuyến mãi theo sản phẩm.</p>
        </div>
        <button
          onClick={() => {
            setEditingPromo(null);
            setIsFormOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2"
        >
          <span>➕</span> Tạo Khuyến Mãi
        </button>
      </div>

      {/* Tabs and Search Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-initial px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {tab === "ALL"
                ? "Tất cả"
                : tab === "ACTIVE"
                ? "Đang hoạt động"
                : "Tạm ngưng / Hết hạn"}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên hoặc mã code..."
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Grid of Promotions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.map((promo) => {
          const expired = isExpired(promo.end_date);
          const isActive = promo.status === "ACTIVE" && !expired;
          const isProdDiscount = promo.type === "PRODUCT_DISCOUNT";

          // Calculate summary text
          let discountLabel = "";
          if (promo.discount_type === "PERCENT") {
            discountLabel = `Giảm ${promo.discount_value}%`;
          } else if (promo.discount_type === "FLAT_PRICE") {
            discountLabel = `Đồng giá ${Number(promo.discount_value).toLocaleString('vi-VN')}đ`;
          } else {
            discountLabel = `Giảm ${Number(promo.discount_value).toLocaleString('vi-VN')}đ`;
          }

          const targetLabel = isProdDiscount ? "Áp dụng cho món ăn" : "Áp dụng toàn đơn hàng";

          // Parse applicable variants to show number of items
          let applicableCount = 0;
          if (isProdDiscount && promo.applicable_products_json) {
            try {
              applicableCount = JSON.parse(promo.applicable_products_json).length;
            } catch (e) {}
          }

          return (
            <div
              key={promo.id}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition duration-200 ${
                !isActive ? "opacity-75" : ""
              }`}
            >
              {/* Card Header (Status / Brand) */}
              <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 bg-gray-200/60 px-2.5 py-1 rounded-full">
                  🏢 {getBrandName(promo.brand_id)}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    expired
                      ? "bg-red-50 text-red-600 border border-red-100"
                      : promo.status === "INACTIVE"
                      ? "bg-yellow-50 text-yellow-600 border border-yellow-100"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                  }`}
                >
                  {expired ? "Đã hết hạn" : promo.status === "INACTIVE" ? "Tạm ngưng" : "Đang chạy"}
                </span>
              </div>

              {/* Card Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2">
                    {promo.name}
                  </h3>

                  {/* Promo Ticket / Code */}
                  {promo.code ? (
                    <div className="inline-flex items-center gap-1.5 border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-1 rounded-xl text-indigo-700 font-black text-sm tracking-wider uppercase mb-4">
                      🎟️ {promo.code}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 px-3 py-1 rounded-xl font-bold text-xs mb-4">
                      ⚡ Tự động áp dụng
                    </div>
                  )}

                  {/* Discount & Target Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-orange-600">
                        {discountLabel}
                      </span>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        ({promo.discount_type})
                      </span>
                    </div>

                    <div className="text-sm font-medium text-gray-700">
                      🎯 {targetLabel}{" "}
                      {isProdDiscount && (
                        <span className="text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded ml-1">
                          ({applicableCount} món)
                        </span>
                      )}
                    </div>

                    {Number(promo.min_order_value) > 0 && (
                      <div className="text-xs font-semibold text-gray-500 bg-orange-50/50 border border-orange-100/60 px-2 py-1 rounded-lg w-fit">
                        💰 Đơn tối thiểu: {Number(promo.min_order_value).toLocaleString('vi-VN')}đ
                      </div>
                    )}
                  </div>
                </div>

                {/* Date / Time */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <div className="text-xs font-medium text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Bắt đầu:</span>
                      <span className="font-bold text-gray-600">
                        {formatDateTime(promo.start_date)}
                      </span>
                    </div>
                    {promo.end_date && (
                      <div className="flex justify-between">
                        <span>Kết thúc:</span>
                        <span className="font-bold text-gray-600">
                          {formatDateTime(promo.end_date)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex justify-end gap-2.5">
                <button
                  onClick={() => {
                    setEditingPromo(promo);
                    setIsFormOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 font-bold text-xs rounded-lg transition active:scale-95"
                >
                  Sửa
                </button>
                <button
                  onClick={() => setDeleteConfirmId(promo.id)}
                  className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 font-bold text-xs rounded-lg transition active:scale-95"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPromotions.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16 px-4">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🏷️
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Không tìm thấy khuyến mãi nào</h3>
          <p className="text-gray-500 mb-4">
            Hãy điều chỉnh bộ lọc hoặc tạo một chương trình khuyến mãi mới.
          </p>
        </div>
      )}

      {/* Promotion Form Dialog Modal */}
      {isFormOpen && (
        <PromotionForm
          initialData={editingPromo}
          brands={brands}
          categories={categories}
          products={products}
          variants={variants}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPromo(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center animate-slide-up">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl mx-auto mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-gray-500 mb-6">
              Bạn có chắc chắn muốn xoá chương trình khuyến mãi này? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                {deletingId === deleteConfirmId ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
