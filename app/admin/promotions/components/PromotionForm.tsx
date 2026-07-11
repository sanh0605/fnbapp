"use client";

import { useState, useEffect, useId } from "react";
import { savePromotion } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/format";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface PromotionFormProps {
  initialData?: DBPromotion;
  brands: DBBrand[];
  categories: DBProductCategory[];
  products: DBProduct[];
  variants: DBProductVariant[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PromotionForm({
  initialData,
  brands,
  categories,
  products,
  variants,
  onClose,
  onSuccess,
}: PromotionFormProps) {
  const formId = useId();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [brandId, setBrandId] = useState("");
  const [type, setType] = useState("ORDER_DISCOUNT");
  const [discountType, setDiscountType] = useState("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [variantValues, setVariantValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setBrandId(initialData.brand_id || "");
      setType(initialData.type || "ORDER_DISCOUNT");
      setDiscountType(initialData.discount_type || "PERCENT");
      setDiscountValue(String(initialData.discount_value || ""));
      setMinOrderValue(String(initialData.min_order_value || ""));
      
      const getLocalISOTime = (dateString: string) => {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "";
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      };

      if (initialData.start_date) {
        setStartDate(getLocalISOTime(initialData.start_date));
      } else {
        setStartDate("");
      }
      if (initialData.end_date) {
        setEndDate(getLocalISOTime(initialData.end_date));
      } else {
        setEndDate("");
      }
      
      setStatus(initialData.status || "ACTIVE");
      
      try {
        if (initialData.applicable_products_json) {
          const parsed = JSON.parse(initialData.applicable_products_json);
          if (Array.isArray(parsed)) {
            setSelectedVariants(parsed);
            setVariantValues({});
          } else {
            setSelectedVariants(Object.keys(parsed));
            const stringifiedVals: Record<string, string> = {};
            Object.keys(parsed).forEach(k => {
              stringifiedVals[k] = String(parsed[k]);
            });
            setVariantValues(stringifiedVals);
          }
        } else {
          setSelectedVariants([]);
          setVariantValues({});
        }
      } catch (e) {
        setSelectedVariants([]);
        setVariantValues({});
      }
    } else {
      setName("");
      setCode("");
      setBrandId("");
      setType("ORDER_DISCOUNT");
      setDiscountType("PERCENT");
      setDiscountValue("");
      setMinOrderValue("0");
      
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
      setStartDate(localISOTime);
      
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const localEndISOTime = new Date(nextWeek.getTime() - tzOffset).toISOString().slice(0, 16);
      setEndDate(localEndISOTime);
      
      setSelectedVariants([]);
      setVariantValues({});
      setStatus("ACTIVE");
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Vui lòng điền tên chương trình khuyến mãi.");
    if (Number(discountValue) <= 0) return setError("Giá trị giảm giá phải lớn hơn 0.");
    if (discountType === "PERCENT" && Number(discountValue) > 100) {
      return setError("Giảm giá theo % không được vượt quá 100%.");
    }
    if (!startDate) return setError("Vui lòng chọn ngày bắt đầu.");
    if (endDate && new Date(endDate) <= new Date(startDate)) {
      return setError("Ngày kết thúc phải sau ngày bắt đầu.");
    }
    if (type === "PRODUCT_DISCOUNT" && selectedVariants.length === 0) {
      return setError("Vui lòng chọn ít nhất một sản phẩm áp dụng.");
    }

    setLoading(true);
    setError("");

    let applicableProductsJson = "";
    if (type === "PRODUCT_DISCOUNT") {
      const obj: Record<string, number> = {};
      selectedVariants.forEach((vId) => {
        const customVal = variantValues[vId];
        obj[vId] = customVal !== undefined && customVal !== "" 
          ? Number(customVal) 
          : Number(discountValue);
      });
      applicableProductsJson = JSON.stringify(obj);
    }

    const promoPayload = {
      id: initialData?.id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      brand_id: brandId,
      type,
      discount_type: discountType,
      discount_value: Number(discountValue),
      min_order_value: Number(minOrderValue || 0),
      start_date: new Date(startDate).toISOString(),
      end_date: endDate ? new Date(endDate).toISOString() : "",
      applicable_products_json: applicableProductsJson,
      status,
    };

    const res = await savePromotion(promoPayload);
    setLoading(false);
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setError(res.error || "Có lỗi xảy ra, vui lòng thử lại.");
    }
  };

  const toggleVariantSelection = (variantId: string) => {
    setSelectedVariants((prev) => {
      const isSelected = prev.includes(variantId);
      if (isSelected) {
        const newVals = { ...variantValues };
        delete newVals[variantId];
        setVariantValues(newVals);
        return prev.filter((id) => id !== variantId);
      } else {
        return [...prev, variantId];
      }
    });
  };

  const handleSelectGroup = (variantIds: string[], isSelected: boolean) => {
    if (isSelected) {
      setSelectedVariants(prev => Array.from(new Set([...prev, ...variantIds])));
    } else {
      setSelectedVariants(prev => prev.filter(id => !variantIds.includes(id)));
    }
  };

  const groupedByCategory = categories.map((cat) => {
    const catProducts = products.filter((p) => p.category_id === cat.id);
    
    const catGroupedProducts = catProducts.map((prod) => {
      const pVars = variants.filter((v) => v.product_id === prod.id);
      return {
        product: prod,
        variants: pVars,
      };
    }).filter(group => group.variants.length > 0);

    return {
      category: cat,
      products: catGroupedProducts,
      allVariantIds: catGroupedProducts.flatMap(p => p.variants.map((v: any) => v.id as string))
    };
  }).filter(group => group.products.length > 0);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-surface-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[90vh]">
        <div className="p-5 border-b border-border flex justify-between items-center bg-surface-secondary/50">
          <h3 className="text-xl font-bold text-text-primary">
            {initialData ? "Chỉnh sửa khuyến mãi" : "Thêm chương trình khuyến mãi mới"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 border-border rounded-full text-text-muted hover:bg-gray-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div role="alert" aria-live="polite" className="bg-danger/10 text-danger text-sm px-4 py-3 rounded-xl border border-danger/20 font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 md:col-span-2">
              <label htmlFor={`${formId}-name`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Tên chương trình *</label>
              <input
                id={`${formId}-name`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Happy Hour Giảm 10%"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-code`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Mã Code (Để nhập thủ công)</label>
              <input
                id={`${formId}-code`}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ví dụ: HAPPY10 (để trống nếu tự động)"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-brandId`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Áp dụng thương hiệu</label>
              <select
                id={`${formId}-brandId`}
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              >
                <option value="">Tất cả thương hiệu (Toàn hệ thống)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-type`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Đối tượng giảm giá</label>
              <select
                id={`${formId}-type`}
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              >
                <option value="ORDER_DISCOUNT">Đơn hàng (Tổng bill)</option>
                <option value="PRODUCT_DISCOUNT">Món ăn cụ thể</option>
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-status`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Trạng thái</label>
              <select
                id={`${formId}-status`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              >
                <option value="ACTIVE">Hoạt động (Active)</option>
                <option value="INACTIVE">Không hoạt động (Inactive)</option>
              </select>
            </div>

             <div>
               <label htmlFor={`${formId}-discountType`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Hình thức giảm giá</label>
               <select
                 id={`${formId}-discountType`}
                 value={discountType}
                 onChange={(e) => setDiscountType(e.target.value)}
                 className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
               >
                 <option value="PERCENT">Phần trăm (%)</option>
                 <option value="FLAT_VND">Số tiền giảm cố định (đ)</option>
                 <option value="FLAT_PRICE">Đồng giá (đ)</option>
               </select>
             </div>
 
             <div>
               <label htmlFor={`${formId}-discountValue`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Giá trị giảm giá *</label>
               <input
                 id={`${formId}-discountValue`}
                 type="number"
                 value={discountValue}
                 onChange={(e) => setDiscountValue(e.target.value)}
                 placeholder={discountType === "PERCENT" ? "Ví dụ: 10" : discountType === "FLAT_PRICE" ? "Ví dụ: 15000" : "Ví dụ: 20000"}
                 className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
               />
             </div>

            <div>
              <label htmlFor={`${formId}-minOrderValue`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Đơn tối thiểu để áp dụng (đ)</label>
              <input
                id={`${formId}-minOrderValue`}
                type="number"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="Ví dụ: 50000"
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-startDate`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Ngày/Giờ bắt đầu *</label>
              <input
                id={`${formId}-startDate`}
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              />
            </div>

            <div>
              <label htmlFor={`${formId}-endDate`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Ngày/Giờ kết thúc</label>
              <input
                id={`${formId}-endDate`}
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-1 focus:ring-focus-ring"
              />
            </div>
          </div>

          {type === "PRODUCT_DISCOUNT" && (
            <div className="border border-border rounded-xl p-4 bg-surface-secondary/50 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-border">
                <label className="block text-xs font-bold uppercase text-text-muted tracking-wider">Chọn các món áp dụng giảm giá *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariants(variants.map((v: any) => v.id))}
                    className="text-[11px] text-primary hover:text-primary-hover font-bold px-2 py-1 bg-surface-card border border-primary/20 rounded-lg hover:bg-primary-soft transition active:scale-95"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariants([])}
                    className="text-[11px] text-danger hover:text-danger-active font-bold px-2 py-1 bg-surface-card border border-danger/30 rounded-lg hover:bg-danger/10 transition active:scale-95"
                  >
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-6 pr-2 divide-y divide-gray-100">
                {groupedByCategory.map(({ category, products: catProducts, allVariantIds }) => {
                  const isCatSelected = allVariantIds.every((id: string) => selectedVariants.includes(id)) && allVariantIds.length > 0;
                  
                  return (
                    <div key={category.id} className="pt-4 first:pt-0">
                      <div className="flex items-center justify-between mb-3 bg-surface-secondary/50 p-2 rounded-lg">
                        <h4 className="font-bold text-text-primary uppercase tracking-wide text-[13px]">{category.name}</h4>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(allVariantIds, !isCatSelected)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${isCatSelected ? 'bg-primary/20 text-primary-active hover:bg-primary/30' : 'bg-surface-card border border-border text-text-secondary hover:bg-surface-secondary'}`}
                        >
                          {isCatSelected ? "Bỏ chọn nhóm" : "Chọn nhóm này"}
                        </button>
                      </div>

                      <div className="space-y-4 pl-2 border-l-2 border-border ml-1">
                        {catProducts.map(({ product, variants: prodVariants }) => {
                          const prodVariantIds = prodVariants.map((v: any) => v.id as string);
                          const isProdSelected = prodVariantIds.every((id: string) => selectedVariants.includes(id)) && prodVariantIds.length > 0;

                          return (
                            <div key={product.id} className="relative">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-sm font-bold text-text-secondary">{product.name}</p>
                                <button
                                  type="button"
                                  onClick={() => handleSelectGroup(prodVariantIds, !isProdSelected)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded transition ${isProdSelected ? 'bg-primary-soft text-primary' : 'bg-surface-secondary text-text-muted hover:border-border'}`}
                                >
                                  {isProdSelected ? "Bỏ chọn" : "Chọn tất cả size"}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {prodVariants.map((v: any) => {
                                  const isSelected = selectedVariants.includes(v.id);
                                  return (
                                    <div key={v.id} className={`flex items-center gap-1.5 p-1 border rounded-xl transition ${
                                      isSelected ? "bg-primary-soft/50 border-primary/40" : "bg-surface-card border-border"
                                    }`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleVariantSelection(v.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                          isSelected
                                            ? "text-primary-active"
                                            : "text-text-secondary hover:bg-surface-secondary"
                                        }`}
                                      >
                                        Size {v.size_name || "Mặc định"} ({formatNumber(v.price)})
                                      </button>
                                      {isSelected && (
                                        <input
                                          type="number"
                                          placeholder={discountValue || (discountType === "PERCENT" ? "%" : "đ")}
                                          value={variantValues[v.id] ?? ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setVariantValues(prev => ({
                                              ...prev,
                                              [v.id]: val
                                            }));
                                          }}
                                          className="w-16 px-2 py-0.5 border border-border rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-focus-ring text-right font-bold text-primary-active bg-surface-card"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-5 flex justify-end gap-3 bg-surface-card sticky bottom-0 z-10 pb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-surface-secondary active:scale-[0.98] transition"
            >
              Hủy
            </button>
            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Đang lưu..."
              className="px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-hover active:scale-[0.98] transition shadow-md"
            >
              Lưu thông tin
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
