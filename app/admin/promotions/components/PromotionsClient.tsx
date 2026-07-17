"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/lib/use-url-state";
import { deletePromotionAction } from "../actions";
import { PromotionForm } from "./PromotionForm";
import { formatNumber } from "@/lib/format";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";

interface PromotionsClientProps {
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
}

export default function PromotionsClient({
  promotions,
  brands,
  products,
  variants,
  categories,
}: PromotionsClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useUrlState<string>("status", "ALL");
  const [typeFilter, setTypeFilter] = useUrlState<string>("type", "ALL");
  const [searchTerm, setSearchTerm] = useUrlState<string>("q", "");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<DBPromotion | undefined>(undefined);
  const [deleteId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await deletePromotionAction(deleteId);
      setDeleteConfirmId(null);
      router.refresh();
    }
  };

  const getBrandName = (brandId: string) => {
    if (!brandId) return "Toàn hệ thống";
    const brand = brands.find((b) => b.id === brandId);
    return brand ? brand.name : "Không xác định";
  };

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

  const filteredPromotions = useMemo(() => {
    return promotions.filter((promo) => {
      const matchesSearch =
        promo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (promo.code && promo.code.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      const expired = isExpired(promo.end_date || "");
      const matchesStatus = 
        statusFilter === "ALL" || 
        (statusFilter === "ACTIVE" && promo.status === "ACTIVE" && !expired) ||
        (statusFilter === "INACTIVE" && (promo.status === "INACTIVE" || expired)) ||
        (statusFilter === "EXPIRED" && expired);

      if (!matchesStatus) return false;

      const matchesType = typeFilter === "ALL" || promo.type === typeFilter;
      
      return matchesType;
    });
  }, [promotions, searchTerm, statusFilter, typeFilter]);

  const rightContent = (
    <button
      onClick={() => {
        setEditingPromo(undefined);
        setIsFormOpen(true);
      }}
      className="bg-primary hover:bg-primary-hover text-white font-bold px-4 py-2 rounded-lg text-sm transition shadow-md active:scale-[0.98]"
    >
      + Tạo Khuyến Mãi
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Khuyến Mãi"
        subtitle="Quản lý mã giảm giá, chiết khấu hóa đơn và khuyến mãi theo sản phẩm."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên, mã code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Đang chạy</option>
            <option value="INACTIVE">Tạm ngưng / Hết hạn</option>
            <option value="EXPIRED">Chỉ đã hết hạn</option>
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Loại hình</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full md:w-44 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Mọi đối tượng</option>
            <option value="ORDER_DISCOUNT">Giảm đơn hàng</option>
            <option value="PRODUCT_DISCOUNT">Giảm theo món</option>
          </select>
        </div>
      
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPromotions.map((promo) => {
          const expired = isExpired(promo.end_date || "");
          const isActive = promo.status === "ACTIVE" && !expired;
          const isProdDiscount = promo.type === "PRODUCT_DISCOUNT";

          let discountLabel = "";
          if (promo.discount_type === "PERCENT") {
            discountLabel = `Giảm ${promo.discount_value}%`;
          } else if (promo.discount_type === "FLAT_PRICE") {
            discountLabel = `Đồng giá ${formatNumber(promo.discount_value)}`;
          } else {
            discountLabel = `Giảm ${formatNumber(promo.discount_value)}`;
          }

          const targetLabel = isProdDiscount ? "Áp dụng cho món ăn" : "Áp dụng toàn đơn hàng";

          let applicableCount = 0;
          if (isProdDiscount && promo.applicable_products_json) {
            try {
              const parsed = JSON.parse(promo.applicable_products_json);
              applicableCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
            } catch (e) {}
          }

          return (
            <div
              key={promo.id}
              className={`bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col hover:shadow-md transition duration-200 ${
                !isActive ? "opacity-75 bg-surface-secondary/50" : ""
              }`}
            >
              <div className="p-4 bg-surface-secondary/50 border-b border-border flex justify-between items-center">
                <span className="text-xs font-bold text-text-muted border-border/60 px-2.5 py-1 rounded-full">
                  🏢 {getBrandName(promo.brand_id || "")}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    expired
                      ? "bg-danger/10 text-danger border border-danger/20"
                      : promo.status === "INACTIVE"
                      ? "bg-warning/10 text-warning border border-yellow-100"
                      : "bg-success/10 text-success border border-success/20"
                  }`}
                >
                  {expired ? "Đã hết hạn" : promo.status === "INACTIVE" ? "Tạm ngưng" : "Đang chạy"}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-text-primary leading-snug mb-2 line-clamp-1">
                    {promo.name}
                  </h3>

                  {promo.code ? (
                    <div className="inline-flex items-center gap-1.5 border border-dashed border-primary/40 bg-primary-soft/50 px-3 py-1 rounded-xl text-primary-active font-black text-sm tracking-wider uppercase mb-4">
                      🎟️ {promo.code}
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 bg-primary-soft text-primary px-3 py-1 rounded-xl font-bold text-xs mb-4">
                      ⚡ Tự động áp dụng
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-warning">
                        {discountLabel}
                      </span>
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                        ({promo.discount_type})
                      </span>
                    </div>

                    <div className="text-sm font-medium text-text-secondary">
                      🎯 {targetLabel}{" "}
                      {isProdDiscount && (
                        <span className="text-primary font-bold bg-primary-soft px-1.5 py-0.5 rounded ml-1">
                          ({applicableCount} món)
                        </span>
                      )}
                    </div>

                    {Number(promo.min_order_value) > 0 && (
                      <div className="text-xs font-semibold text-text-muted bg-warning/10 border border-warning/20 px-2 py-1 rounded-lg w-fit">
                        💰 Đơn tối thiểu: {formatNumber(promo.min_order_value)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-2">
                  <div className="text-[11px] font-medium text-text-muted space-y-1">
                    <div className="flex justify-between">
                      <span>Bắt đầu:</span>
                      <span className="font-bold text-text-secondary">
                        {formatDateTime(promo.start_date || "")}
                      </span>
                    </div>
                    {promo.end_date && (
                      <div className="flex justify-between">
                        <span>Kết thúc:</span>
                        <span className="font-bold text-text-secondary">
                          {formatDateTime(promo.end_date)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-surface-secondary/30 flex justify-end gap-2.5">
                <button
                  onClick={() => {
                    setEditingPromo(promo);
                    setIsFormOpen(true);
                  }}
                  className="px-3.5 py-1.5 min-h-[44px] bg-primary-soft hover:bg-primary/20 border border-primary/20 text-primary-active font-bold text-xs rounded-lg transition active:scale-95"
                >
                  Sửa
                </button>
                <button
                  onClick={() => setDeleteConfirmId(promo.id)}
                  className="px-3.5 py-1.5 min-h-[44px] bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger font-bold text-xs rounded-lg transition active:scale-95"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPromotions.length === 0 && (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border text-center py-16 px-4">
          <div className="w-16 h-16 bg-primary-soft text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🏷️
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">Không tìm thấy khuyến mãi nào</h3>
          <p className="text-text-muted">
            Hãy điều chỉnh bộ lọc hoặc tạo một chương trình khuyến mãi mới.
          </p>
        </div>
      )}

      {isFormOpen && (
        <PromotionForm
          initialData={editingPromo}
          brands={brands}
          categories={categories}
          products={products}
          variants={variants}
          onClose={() => {
            setIsFormOpen(false);
            setEditingPromo(undefined);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      <DeleteConfirmModal
        isOpen={!!deleteId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
        description="Bạn có chắc chắn muốn xoá chương trình khuyến mãi này? Thao tác này không thể hoàn tác."
      />
    </div>
  );
}
