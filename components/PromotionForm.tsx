"use client";

import { useState, useEffect } from "react";
import { savePromotion } from "@/app/actions/promotions";

interface PromotionFormProps {
  initialData?: any;
  brands: any[];
  categories: any[];
  products: any[];
  variants: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function PromotionForm({
  initialData,
  brands,
  categories,
  products,
  variants,
  onClose,
  onSuccess,
}: PromotionFormProps) {
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

      // Format dates for datetime-local input (YYYY-MM-DDTHH:MM)
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
      // Set defaults for new promo
      setName("");
      setCode("");
      setBrandId("");
      setType("ORDER_DISCOUNT");
      setDiscountType("PERCENT");
      setDiscountValue("");
      setMinOrderValue("0");
      
      const now = new Date();
      // local time representation for datetime-local input
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

  // Group variants by category, then by product
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">
            {initialData ? "Chỉnh sửa khuyến mãi" : "Thêm chương trình khuyến mãi mới"}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tên CTKM */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Tên chương trình *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Happy Hour Giảm 10%"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Mã khuyến mãi */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Mã Code (Để nhập thủ công)</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ví dụ: HAPPY10 (để trống nếu tự động)"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Phạm vi thương hiệu */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Áp dụng thương hiệu</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tất cả thương hiệu (Toàn hệ thống)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Đối tượng giảm giá (Order vs Product) */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Đối tượng giảm giá</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="ORDER_DISCOUNT">Đơn hàng (Tổng bill)</option>
                <option value="PRODUCT_DISCOUNT">Món ăn cụ thể</option>
              </select>
            </div>

            {/* Trạng thái hoạt động */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="ACTIVE">Hoạt động (Active)</option>
                <option value="INACTIVE">Không hoạt động (Inactive)</option>
              </select>
            </div>

             {/* Loại chiết khấu */}
             <div>
               <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Hình thức giảm giá</label>
               <select
                 value={discountType}
                 onChange={(e) => setDiscountType(e.target.value)}
                 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
               >
                 <option value="PERCENT">Phần trăm (%)</option>
                 <option value="VND">Số tiền giảm cố định (đ)</option>
                 <option value="FLAT_PRICE">Đồng giá (đ)</option>
               </select>
             </div>
 
             {/* Giá trị chiết khấu */}
             <div>
               <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Giá trị giảm giá *</label>
               <input
                 type="number"
                 value={discountValue}
                 onChange={(e) => setDiscountValue(e.target.value)}
                 placeholder={discountType === "PERCENT" ? "Ví dụ: 10" : discountType === "FLAT_PRICE" ? "Ví dụ: 15000" : "Ví dụ: 20000"}
                 className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
               />
             </div>

            {/* Giá trị đơn tối thiểu */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Đơn tối thiểu để áp dụng (đ)</label>
              <input
                type="number"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                placeholder="Ví dụ: 50000"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Ngày bắt đầu */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Ngày/Giờ bắt đầu *</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Ngày kết thúc */}
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1.5 tracking-wider">Ngày/Giờ kết thúc</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Chọn món áp dụng (chỉ khi PRODUCT_DISCOUNT) */}
          {type === "PRODUCT_DISCOUNT" && (
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-gray-100">
                <label className="block text-xs font-bold uppercase text-gray-400 tracking-wider">Chọn các món áp dụng giảm giá *</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedVariants(variants.map((v: any) => v.id))}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition active:scale-95"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVariants([])}
                    className="text-[11px] text-red-600 hover:text-red-800 font-bold px-2 py-1 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition active:scale-95"
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
                      <div className="flex items-center justify-between mb-3 bg-gray-100/50 p-2 rounded-lg">
                        <h4 className="font-bold text-gray-800 uppercase tracking-wide text-[13px]">{category.name}</h4>
                        <button
                          type="button"
                          onClick={() => handleSelectGroup(allVariantIds, !isCatSelected)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition ${isCatSelected ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                        >
                          {isCatSelected ? "Bỏ chọn nhóm" : "Chọn nhóm này"}
                        </button>
                      </div>

                      <div className="space-y-4 pl-2 border-l-2 border-gray-100 ml-1">
                        {catProducts.map(({ product, variants: prodVariants }) => {
                          const prodVariantIds = prodVariants.map((v: any) => v.id as string);
                          const isProdSelected = prodVariantIds.every((id: string) => selectedVariants.includes(id)) && prodVariantIds.length > 0;

                          return (
                            <div key={product.id} className="relative">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-sm font-bold text-gray-700">{product.name}</p>
                                <button
                                  type="button"
                                  onClick={() => handleSelectGroup(prodVariantIds, !isProdSelected)}
                                  className={`text-[10px] px-1.5 py-0.5 rounded transition ${isProdSelected ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                >
                                  {isProdSelected ? "Bỏ chọn" : "Chọn tất cả size"}
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2.5">
                                {prodVariants.map((v: any) => {
                                  const isSelected = selectedVariants.includes(v.id);
                                  return (
                                    <div key={v.id} className={`flex items-center gap-1.5 p-1 border rounded-xl transition ${
                                      isSelected ? "bg-blue-50/50 border-blue-400" : "bg-white border-gray-200"
                                    }`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleVariantSelection(v.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                                          isSelected
                                            ? "text-blue-700"
                                            : "text-gray-600 hover:bg-gray-50"
                                        }`}
                                      >
                                        Size {v.size_name || "Mặc định"} ({Number(v.price).toLocaleString()}đ)
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
                                          className="w-16 px-2 py-0.5 border border-gray-200 rounded-lg text-[11px] focus:outline-none focus:border-blue-500 text-right font-bold text-blue-700 bg-white"
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

          <div className="border-t border-gray-100 pt-5 flex justify-end gap-3 bg-white sticky bottom-0 z-10 pb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-sm">⏳</span> Đang lưu...
                </>
              ) : (
                "Lưu thông tin"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
