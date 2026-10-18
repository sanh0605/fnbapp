"use client";

import { useState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Folder, UtensilsCrossed } from "lucide-react";
import { savePromotion } from "@/app/admin/promotions/actions";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { formatNumber } from "@/lib/shared/format";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import type { DBPromotion, DBBrand, DBProduct, DBProductVariant, DBProductCategory } from "@/types/db";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { safeReturnTo } from "@/lib/shared/return-to";
import { SaigonDateTimeInput } from "@/components/ui/SaigonDateTimeInput";
import { Alert } from "@/components/ui/Alert";

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
  const returnTo = safeReturnTo(rawReturnTo, "/admin/promotions");
  const router = useRouter();
  const formId = useId();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [brandId, setBrandId] = useState("");
  const [type, setType] = useState("ORDER_DISCOUNT");
  const [discountType, setDiscountType] = useState("PERCENT");
  const [stackable, setStackable] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [minOrderValue, setMinOrderValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [variantValues, setVariantValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === "ORDER_DISCOUNT" && discountType === "FLAT_PRICE") {
      setDiscountType("PERCENT");
      setDiscountValue("");
    }
  };

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setCode(initialData.code || "");
      setBrandId(initialData.brand_id || "");
      const initialType = initialData.type || "ORDER_DISCOUNT";
      setType(initialType);
      const initialDiscountType = initialData.discount_type || "PERCENT";
      const isForcedPercent = initialType === "ORDER_DISCOUNT" && initialDiscountType === "FLAT_PRICE";
      setDiscountType(isForcedPercent ? "PERCENT" : initialDiscountType);
      setStackable(initialData.stackable === true);
      setDiscountValue(isForcedPercent ? "" : String(initialData.discount_value || ""));
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
      setStackable(false);
      setDiscountValue("");
      setMinOrderValue("");
      
      const now = new Date();
      setStartDate(toSaigonIsoString(now).slice(0, 16));
      
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEndDate(toSaigonIsoString(nextWeek).slice(0, 10) + "T23:59");
      
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
      stackable,
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        {/* Section 1: Chương trình */}
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-text-primary">Chương trình</h3>
          <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="col-span-1 md:col-span-2">
              <Field label="Tên chương trình" htmlFor={`${formId}-name`} required>
                <TextInput
                  id={`${formId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Khai trương giảm 10%"
                  required
                />
              </Field>
            </div>

            <div>
              <Field
                label="Mã khuyến mãi (để nhập tay)"
                htmlFor={`${formId}-code`}
                hint="Để trống thì máy tự đặt mã."
              >
                <TextInput
                  id={`${formId}-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ví dụ: KHAITRUONG10"
                />
              </Field>
            </div>

            <div>
              <Field label="Áp dụng thương hiệu" htmlFor={`${formId}-brandId`}>
                <SearchableSelect
                  id={`${formId}-brandId`}
                  value={brandId}
                  onChange={setBrandId}
                  options={[
                    { id: "", label: "Toàn hệ thống" },
                    ...brands.map((b) => ({ id: b.id, label: b.name })),
                  ]}
                  placeholder="Toàn hệ thống"
                />
              </Field>
            </div>

            <div>
              <Field label="Dùng chung với khuyến mãi khác" htmlFor={`${formId}-stackable`}>
                <Select
                  id={`${formId}-stackable`}
                  value={stackable ? "yes" : "no"}
                  onChange={(e) => setStackable(e.target.value === "yes")}
                >
                  <option value="no">Không</option>
                  <option value="yes">Có</option>
                </Select>
              </Field>
            </div>

            <div>
              <Field label="Trạng thái" htmlFor={`${formId}-status`}>
                <Select
                  id={`${formId}-status`}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Không hoạt động</option>
                </Select>
              </Field>
            </div>
          </div>
        </div>

        {/* Section 2: Mức giảm */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-base font-semibold text-text-primary">Mức giảm</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Field label="Đối tượng giảm giá" htmlFor={`${formId}-type`}>
                <Select
                  id={`${formId}-type`}
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                >
                  <option value="ORDER_DISCOUNT">Đơn hàng (Tổng hoá đơn)</option>
                  <option value="PRODUCT_DISCOUNT">Món ăn cụ thể</option>
                </Select>
              </Field>
            </div>

            <div>
              <Field label="Hình thức giảm giá" htmlFor={`${formId}-discountType`}>
                <Select
                  id={`${formId}-discountType`}
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                >
                  <option value="PERCENT">Phần trăm (%)</option>
                  <option value="FLAT_VND">Số tiền giảm cố định (đ)</option>
                  {type !== "ORDER_DISCOUNT" && (
                    <option value="FLAT_PRICE">Đồng giá (đ)</option>
                  )}
                </Select>
              </Field>
            </div>

            <div>
              <Field label="Giá trị giảm giá" htmlFor={`${formId}-discountValue`} required>
                <NumberInput
                  id={`${formId}-discountValue`}
                  decimals={0}
                  required
                  min={0}
                  minExclusive
                  unit={discountType === "PERCENT" ? "%" : "đ"}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  example={
                    discountType === "PERCENT"
                      ? "10"
                      : discountType === "FLAT_PRICE"
                      ? "15,000"
                      : "20,000"
                  }
                  value={discountValue === "" ? null : Number(discountValue)}
                  onValueChange={(v) => setDiscountValue(v === null ? "" : String(v))}
                />
              </Field>
            </div>

            <div>
              <Field label="Đơn tối thiểu để áp dụng" htmlFor={`${formId}-minOrderValue`}>
                <NumberInput
                  id={`${formId}-minOrderValue`}
                  decimals={0}
                  unit="đ"
                  min={0}
                  example="50,000"
                  value={minOrderValue === "" ? null : Number(minOrderValue)}
                  onValueChange={(v) => setMinOrderValue(v === null ? "" : String(v))}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Section 3: Thời gian */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-base font-semibold text-text-primary">Thời gian</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Field label="Bắt đầu lúc" htmlFor={`${formId}-startDate`} required>
                <SaigonDateTimeInput
                  id={`${formId}-startDate`}
                  value={startDate}
                  onChange={setStartDate}
                />
              </Field>
            </div>

            <div>
              <Field label="Kết thúc lúc (không bắt buộc)" htmlFor={`${formId}-endDate`}>
                <SaigonDateTimeInput
                  id={`${formId}-endDate`}
                  value={endDate}
                  onChange={setEndDate}
                  clearable
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Section 4: Món áp dụng */}
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-base font-semibold text-text-primary">Món áp dụng</h3>

          {type === "PRODUCT_DISCOUNT" ? (
            <div>
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Chọn món áp dụng</h4>
                <p className="text-xs text-text-muted">Chọn các kích cỡ/món áp dụng khuyến mãi này. Có thể điều chỉnh giá trị giảm riêng cho từng món.</p>
              </div>
              <div className="text-xs font-bold text-primary bg-primary-soft px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
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
                        <Folder className="h-4 w-4 text-text-muted shrink-0" aria-hidden /> {group.category.name}
                      </label>
                      <span className="text-xs text-text-muted font-medium">
                        {group.products.length} sản phẩm
                      </span>
                    </div>

                    <div className="p-3 space-y-3">
                      {group.products.map((item) => {
                        return (
                          <div key={item.product.id} className="p-2 border border-border/40 rounded-lg hover:border-border transition bg-surface-card">
                            <div className="font-bold text-xs text-text-secondary mb-2 px-1 flex items-center gap-1.5">
                              <UtensilsCrossed className="h-4 w-4 text-text-muted shrink-0" aria-hidden />
                              <span>{item.product.name}</span>
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
                                        <div className="text-xs text-text-muted font-medium">
                                          {formatNumber(v.price)}
                                        </div>
                                      </div>
                                    </label>

                                    {isChecked && (
                                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/40">
                                        <span className="text-xs text-text-muted shrink-0">{discountType === "FLAT_PRICE" ? "Giá:" : "Giảm:"}</span>
                                        <div className="w-28">
                                          <NumberInput
                                            id={`${formId}-variant-${v.id}`}
                                            decimals={0}
                                            unit={discountType === "PERCENT" ? "%" : "đ"}
                                            max={discountType === "PERCENT" ? 100 : undefined}
                                            min={0}
                                            example={
                                              discountValue
                                                ? formatNumber(Number(discountValue))
                                                : discountType === "PERCENT"
                                                ? "10"
                                                : "10,000"
                                            }
                                            aria-label={`Giảm riêng: ${item.product.name} ${v.size_name || "Mặc định"}`}
                                            value={
                                              variantValues[v.id] === undefined || variantValues[v.id] === ""
                                                ? null
                                                : Number(variantValues[v.id])
                                            }
                                            onValueChange={(val) => {
                                              setVariantValues((prev) => ({
                                                ...prev,
                                                [v.id]: val === null ? "" : String(val),
                                              }));
                                            }}
                                          />
                                        </div>
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
        ) : (
          <p className="text-sm text-text-secondary">Áp dụng cho toàn đơn, không cần chọn món.</p>
        )}
        </div>

        <FormActionBar
          mode={initialData ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
