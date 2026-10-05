"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { savePromotion } from "@/app/admin/promotions/actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/shared/format";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { safeReturnTo } from "./return-to";
import { SaigonDateTimeInput } from "@/components/ui/SaigonDateTimeInput";

interface PromotionFormProps {
  initialData?: DBPromotion;
  brands: DBBrand[];
  categories: DBProductCategory[];
  products: DBProduct[];
  variants: DBProductVariant[];
  returnTo?: string;
}

export function PromotionForm({
  initialData,
  brands,
  categories,
  products,
  variants,
  returnTo: rawReturnTo,
}: PromotionFormProps) {
  const returnTo = safeReturnTo(rawReturnTo);
  const router = useRouter();
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
        return toSaigonIsoString(d).slice(0, 16);
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
      setStartDate(toSaigonIsoString(now).slice(0, 16));
      
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEndDate(toSaigonIsoString(nextWeek).slice(0, 16));
      
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
    if (endDate && new Date(endDate + ":00+07:00") <= new Date(startDate + ":00+07:00")) {
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
      start_date: new Date(startDate + ":00+07:00").toISOString(),
      end_date: endDate ? new Date(endDate + ":00+07:00").toISOString() : "",
      applicable_products_json: applicableProductsJson,
      status,
    };

    const res = await savePromotion(promoPayload);
    setLoading(false);
    if (res.success) {
      router.push(returnTo);
      router.refresh();
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-4xl shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-5">
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
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
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
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm uppercase focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-brandId`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Áp dụng thương hiệu</label>
            <SearchableSelect
              id={`${formId}-brandId`}
              value={brandId}
              onChange={setBrandId}
              options={[
                { id: "", label: "Tất cả thương hiệu (Toàn hệ thống)" },
                ...brands.map((b) => ({ id: b.id, label: b.name })),
              ]}
              placeholder="Tất cả thương hiệu (Toàn hệ thống)"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-type`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Đối tượng giảm giá</label>
            <select
              id={`${formId}-type`}
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
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
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
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
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
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
              inputMode="numeric"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "PERCENT" ? "Ví dụ: 10" : discountType === "FLAT_PRICE" ? "Ví dụ: 15000" : "Ví dụ: 20000"}
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-minOrderValue`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Đơn tối thiểu để áp dụng (đ)</label>
            <input
              id={`${formId}-minOrderValue`}
              type="number"
              inputMode="numeric"
              value={minOrderValue}
              onChange={(e) => setMinOrderValue(e.target.value)}
              placeholder="Ví dụ: 50000"
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-startDate`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Ngày/Giờ bắt đầu *</label>
            <SaigonDateTimeInput
              id={`${formId}-startDate`}
              value={startDate}
              onChange={setStartDate}
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-endDate`} className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Ngày/Giờ kết thúc (Tuỳ chọn)</label>
            <SaigonDateTimeInput
              id={`${formId}-endDate`}
              value={endDate}
              onChange={setEndDate}
              clearable
              className="w-full border border-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>
        </div>

        {type === "PRODUCT_DISCOUNT" && (
          <div className="border-t border-border pt-4 mt-2">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">Chọn món áp dụng</h4>
                <p className="text-xs text-text-muted">Chọn các kích cỡ/món áp dụng khuyến mãi này. Có thể điều chỉnh giá trị giảm riêng cho từng món.</p>
              </div>
              <div className="text-xs font-bold text-primary bg-primary-soft px-2.5 py-1 rounded-full">
                Đã chọn: {selectedVariants.length} mục
              </div>
            </div>

            <div className="space-y-4 border border-border rounded-xl p-3 bg-surface-secondary/20">
              {groupedByCategory.map((group) => {
                const isAllGroupSelected = group.allVariantIds.every(id => selectedVariants.includes(id));
                const isSomeGroupSelected = group.allVariantIds.some(id => selectedVariants.includes(id)) && !isAllGroupSelected;

                return (
                  <div key={group.category.id} className="border border-border/80 rounded-xl bg-surface-card overflow-hidden">
                    <div className="p-3 bg-surface-secondary/40 border-b border-border/60 flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-text-primary">
                        <input
                          type="checkbox"
                          checked={isAllGroupSelected}
                          ref={el => {
                            if (el) el.indeterminate = isSomeGroupSelected;
                          }}
                          onChange={(e) => handleSelectGroup(group.allVariantIds, e.target.checked)}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        📁 {group.category.name}
                      </label>
                      <span className="text-[11px] text-text-muted font-medium">
                        {group.products.length} sản phẩm
                      </span>
                    </div>

                    <div className="p-3 space-y-3">
                      {group.products.map((item) => {
                        return (
                          <div key={item.product.id} className="p-2 border border-border/40 rounded-lg hover:border-border transition bg-surface-card">
                            <div className="font-bold text-xs text-text-secondary mb-2 px-1">
                              🍽️ {item.product.name}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {item.variants.map((v) => {
                                const isChecked = selectedVariants.includes(v.id);
                                return (
                                  <div
                                    key={v.id}
                                    className={`p-2 rounded-lg border flex flex-col justify-between transition gap-2 ${
                                      isChecked
                                        ? "border-primary bg-primary-soft/30"
                                        : "border-border/60 bg-surface-secondary/30"
                                    }`}
                                  >
                                    <label className="flex items-start gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleVariantSelection(v.id)}
                                        className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-text-primary truncate">
                                          {v.size_name || "Mặc định"}
                                        </div>
                                        <div className="text-[10px] text-text-muted font-medium">
                                          {formatNumber(v.price)}
                                        </div>
                                      </div>
                                    </label>

                                    {isChecked && (
                                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
                                        <span className="text-[10px] text-text-muted">Giảm:</span>
                                        <input
                                          type="number"
                                          inputMode="numeric"
                                          placeholder={discountValue || (discountType === "PERCENT" ? "%" : "đ")}
                                          value={variantValues[v.id] ?? ""}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setVariantValues(prev => ({
                                              ...prev,
                                              [v.id]: val
                                            }));
                                          }}
                                          className="w-20 px-2 py-1 min-h-[36px] border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-focus-ring text-right font-bold text-primary-active bg-surface-card"
                                        />
                                      </div>
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

        <div className="border-t border-border pt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-surface-secondary active:scale-[0.98] transition min-h-[44px] text-center"
          >
            Bỏ
          </button>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang lưu..."
            className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-on-primary bg-primary rounded-xl hover:bg-primary-hover active:scale-[0.98] transition shadow-md min-h-[44px]"
          >
            Lưu thông tin
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
