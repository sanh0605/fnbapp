"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/shared/format";
import { editOrderV2 } from "@/app/admin/orders/order-edit-actions";
import type { OrderListItem } from "@/app/admin/orders/actions";
import type { CartInput } from "@/lib/sales/order-cart";
import { LineItemEditor, type EditItem } from "@/app/admin/orders/components/LineItemEditor";
import { DiscountEditor } from "@/app/admin/orders/components/DiscountEditor";
import { Button } from "@/components/ui/Button";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { X } from "lucide-react";

import { OptionGroupPicker } from "@/components/ui/OptionGroupPicker";
import {
  optionGroupsForProduct,
  type OptionGroup,
  type GroupLink,
} from "@/lib/sales/option-groups";

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;

interface PaymentPart {
  method: "CASH" | "BANK_TRANSFER";
  amount: number;
}

function normalizePaymentMethod(method?: string): "CASH" | "BANK_TRANSFER" {
  if (method === "BANK_TRANSFER" || method === "Chuyen khoan") {
    return "BANK_TRANSFER";
  }
  return "CASH";
}

function expandModifierSnapshots(modifiers: any[]): any[] {
  return modifiers.flatMap((modifier: any) => {
    const qty = Math.max(1, Number(modifier.qty || 1));
    return Array.from({ length: qty }, () => ({
      id: modifier.id,
      name: modifier.name,
      price: Number(modifier.price || 0),
    }));
  });
}

function calcItemTotal(item: EditItem) {
  const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
  const base = (item.unit_price + modsPrice) * item.qty;
  let disc = 0;
  if (item.discount_amount > 0) {
    disc = item.discount_type === "PERCENT" ? (base * item.discount_amount) / 100 : item.discount_amount;
  }
  return Math.max(0, base - disc);
}

interface OrderEditFormProps {
  order: Order;
  brands: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  categories: any[];
  returnTo: string;
  optionGroups?: OptionGroup[];
  optionGroupLinks?: GroupLink[];
}

export function OrderEditForm({
  order,
  brands,
  products,
  variants,
  modifiers,
  categories,
  returnTo,
  optionGroups = [],
  optionGroupLinks = [],
}: OrderEditFormProps) {
  const router = useRouter();
  const viewUrl = `/admin/orders/${encodeURIComponent(order.id)}?returnTo=${encodeURIComponent(returnTo)}`;

  const [items, setItems] = useState<EditItem[]>(() =>
    order.lines.map((l: OrderLine) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      variant_id: l.variant_id,
      size_name: l.size_name,
      unit_price: Number(l.unit_price),
      qty: Number(l.qty),
      modifiers: expandModifierSnapshots(l.modifiers || []),
      discount_amount: Number(l.manual_item_discount || 0),
      line_discount: Number(l.promo_discount || 0),
      line_promo_discount: Number(l.promo_discount || 0),
      line_order_discount_allocation: Number(l.order_discount_allocation || 0),
      line_manual_discount: Number(l.manual_item_discount || 0),
      discount_type: "VND",
    }))
  );

  const [orderDiscount, setOrderDiscount] = useState(Number(order.manual_order_discount || 0));
  const [orderDiscountType, setOrderDiscountType] = useState("VND");
  const [payments, setPayments] = useState<PaymentPart[]>(() => {
    if (Array.isArray(order.payments) && order.payments.length > 0) {
      return order.payments.map((p) => ({
        method: normalizePaymentMethod(p.method),
        amount: Number(p.amount) || 0,
      }));
    }
    const fallbackMethod = normalizePaymentMethod(order.method);
    return [
      {
        method: fallbackMethod,
        amount: Number(order.net_total || 0),
      },
    ];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [editReason, setEditReason] = useState("");

  // Item editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Add product state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addCategory, setAddCategory] = useState<string>("ALL");
  const [addSearch, setAddSearch] = useState("");
  const [selectedNewProduct, setSelectedNewProduct] = useState<any>(null);
  const [selectedNewVariant, setSelectedNewVariant] = useState<any>(null);
  const [selectedNewModifiers, setSelectedNewModifiers] = useState<any[]>([]);
  const [newQty, setNewQty] = useState(1);

  const filteredAddProducts = useMemo(() => {
    let list = products;
    if (addCategory !== "ALL") list = list.filter((p: any) => p.category_id === addCategory);
    if (addSearch) {
      const q = addSearch.toLowerCase();
      list = list.filter((p: any) => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [products, addCategory, addSearch]);

  const calculateSubtotal = () => items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let orderLevelDisc = 0;
    if (orderDiscount > 0) {
      orderLevelDisc = orderDiscountType === "PERCENT" ? (subtotal * orderDiscount) / 100 : orderDiscount;
    }
    const productLevelDisc = items.reduce((sum, item) => sum + Number(item.line_discount || 0), 0);
    return Math.max(0, subtotal - orderLevelDisc - productLevelDisc);
  };

  const confirmAddProduct = () => {
    if (!selectedNewProduct || !selectedNewVariant) return;
    setItems([
      ...items,
      {
        product_id: selectedNewProduct.id,
        product_name: selectedNewProduct.name,
        variant_id: selectedNewVariant.id,
        size_name: selectedNewVariant.size_name,
        unit_price: Number(selectedNewVariant.price),
        qty: newQty,
        modifiers: [...selectedNewModifiers],
        discount_amount: 0,
        line_discount: 0,
        line_promo_discount: 0,
        line_order_discount_allocation: 0,
        line_manual_discount: 0,
        discount_type: "VND",
      },
    ]);
    setIsAddingProduct(false);
    setSelectedNewProduct(null);
    setSelectedNewVariant(null);
    setSelectedNewModifiers([]);
    setNewQty(1);
    setAddSearch("");
    setAddCategory("ALL");
  };

  const totalAmount = calculateTotal();
  const totalParts = payments.reduce((sum, p) => sum + p.amount, 0);

  const isPaymentValid =
    payments.length === 1
      ? true
      : payments.length === 2 &&
        payments.every((p) => p.amount > 0) &&
        payments[0].method !== payments[1].method &&
        totalParts === totalAmount;

  const handleMethodChange = (idx: number, newMethod: "CASH" | "BANK_TRANSFER") => {
    setPayments((prev) =>
      prev.map((p, i) => {
        if (i === idx) return { ...p, method: newMethod };
        if (prev.length === 2 && p.method === newMethod) {
          return { ...p, method: newMethod === "CASH" ? "BANK_TRANSFER" : "CASH" };
        }
        return p;
      })
    );
  };

  const handleAmountChange = (idx: number, amount: number) => {
    setPayments((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, amount } : p))
    );
  };

  const handleAddPaymentPart = () => {
    if (payments.length !== 1) return;
    const currentMethod = payments[0].method;
    const otherMethod: "CASH" | "BANK_TRANSFER" =
      currentMethod === "CASH" ? "BANK_TRANSFER" : "CASH";
    setPayments([
      { method: currentMethod, amount: totalAmount },
      { method: otherMethod, amount: 0 },
    ]);
  };

  const handleRemovePaymentPart = (removeIdx: number) => {
    if (payments.length <= 1) return;
    setPayments((prev) => prev.filter((_, i) => i !== removeIdx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    if (items.length === 0) return;
    if (!editReason.trim()) {
      setInlineError("Lý do chỉnh sửa là bắt buộc");
      return;
    }
    if (payments.length === 2) {
      if (payments.some((p) => p.amount <= 0)) {
        setInlineError("Số tiền mỗi phần phải lớn hơn 0");
        return;
      }
      if (totalParts !== totalAmount) {
        setInlineError("Tổng các phần không khớp với tiền đơn");
        return;
      }
      if (payments[0].method === payments[1].method) {
        setInlineError("Hai phần thanh toán không được trùng phương thức");
        return;
      }
    }
    setIsSaving(true);

    const cartInput: CartInput = {
      brand_id: order.brand_id,
      outlet_id: (order as any).outlet_id || "",
      items: items.map((item) => {
        const manualItemValue = item.discount_amount;
        const manualItemType: "VND" | "PERCENT" = item.discount_type === "PERCENT" ? "PERCENT" : "VND";
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          unit_price_snapshot: item.unit_price,
          promo_discount_snapshot: item.line_promo_discount,
          qty: item.qty,
          modifiers: item.modifiers.map((m) => ({
            modifier_id: m.id,
            modifier_qty: 1,
            modifier_name_snapshot: m.name,
            modifier_price_snapshot: Number(m.price || 0),
          })),
          manual_item_discount: { value: manualItemValue, type: manualItemType },
        };
      }),
      payment_method: payments[0]?.method || "CASH",
      payments: payments.map((p) => ({
        method: p.method,
        amount: payments.length === 1 ? totalAmount : p.amount,
        reference: "",
      })),
      manual_order_discount:
        orderDiscount > 0
          ? { value: orderDiscount, type: orderDiscountType === "PERCENT" ? "PERCENT" : "VND" }
          : null,
      actor: { id: "", name: "" },
    };

    const res = await editOrderV2({
      orderId: order.id,
      expectedVersion: order.version,
      cart: cartInput,
      reason: editReason.trim(),
    });

    setIsSaving(false);

    if (res.success) {
      router.push(`/admin/orders/${encodeURIComponent(res.new_order_id)}?returnTo=${encodeURIComponent(returnTo)}`);
      router.refresh();
    } else {
      setInlineError("Lỗi cập nhật đơn: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      <BackLink href={viewUrl} label={order.display_order_no || order.order_no} />

      <PageHeader
        title="Sửa đơn hàng"
        subtitle={order.display_order_no || order.order_no}
      />

      <form
        onSubmit={handleSave}
        data-testid="form-layout"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start"
      >
        {/* Dishes list */}
        <div
          data-testid="form-lines"
          className="bg-surface-card rounded-card shadow-sm border border-border p-4 space-y-3 lg:col-span-2 lg:col-start-1 lg:row-start-1"
        >
          {inlineError && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/30 flex justify-between">
              <span>{inlineError}</span>
              <button
                type="button"
                onClick={() => setInlineError(null)}
                className="ml-2 text-danger hover:opacity-80"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {items.length === 0 && !isAddingProduct && (
            <div className="text-center text-text-muted py-8">Không có món nào trong đơn</div>
          )}

          {items.map((item, idx) => (
            <LineItemEditor
              key={idx}
              item={item}
              idx={idx}
              isEditing={editingIndex === idx}
              variants={variants}
              groups={optionGroupsForProduct(item.product_id, optionGroups, optionGroupLinks, modifiers)}
              onStartEdit={(i) => setEditingIndex(i)}
              onCancelEdit={() => setEditingIndex(null)}
              onSaveEdit={(i, updatedFields) => {
                setItems(
                  items.map((it, idxIt) => {
                    if (idxIt !== i) return it;
                    return { ...it, ...updatedFields } as EditItem;
                  })
                );
                setEditingIndex(null);
              }}
              onRemove={(i) => {
                setItems(items.filter((_, idxIt) => idxIt !== i));
                if (editingIndex === i) setEditingIndex(null);
              }}
            />
          ))}

          {/* Add Product Section */}
          {isAddingProduct ? (
            <div className="bg-primary-soft p-3 rounded-xl border border-primary/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">Thêm sản phẩm</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingProduct(false);
                    setSelectedNewProduct(null);
                    setSelectedNewVariant(null);
                    setSelectedNewModifiers([]);
                    setNewQty(1);
                  }}
                  className="text-text-muted hover:text-text-secondary"
                  aria-label="Huỷ thêm sản phẩm"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!selectedNewProduct ? (
                <>
                  {/* Search */}
                  <TextInput
                    aria-label="Tìm sản phẩm"
                    placeholder="Ví dụ: Cà phê sữa đá"
                    value={addSearch}
                    onChange={(e) => setAddSearch(e.target.value)}
                  />

                  {/* Category filter */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAddCategory("ALL")}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                        addCategory === "ALL"
                          ? "bg-primary-soft text-primary border-primary font-bold"
                          : "bg-surface-card text-text-secondary border-border"
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setAddCategory(c.id)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          addCategory === c.id
                            ? "bg-primary-soft text-primary border-primary font-bold"
                            : "bg-surface-card text-text-secondary border-border"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {filteredAddProducts.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedNewProduct(p);
                          setSelectedNewVariant(null);
                        }}
                        className="p-2 rounded-lg border border-border bg-surface-card hover:border-primary text-center transition-colors min-h-[44px] md:min-h-[40px]"
                      >
                        <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                      </button>
                    ))}
                    {filteredAddProducts.length === 0 && (
                      <div className="col-span-2 sm:col-span-3 text-center text-text-muted text-sm py-4">
                        Không tìm thấy sản phẩm
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected product detail */}
                  <div className="font-bold text-text-primary">{selectedNewProduct.name}</div>

                  {/* Variant selection */}
                  <div>
                    <div className="text-xs font-medium text-text-muted mb-1.5">Size</div>
                    <div className="flex flex-wrap gap-2">
                      {variants
                        .filter((v: any) => v.product_id === selectedNewProduct.id)
                        .map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedNewVariant(v)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors min-h-[44px] md:min-h-[40px] ${
                              selectedNewVariant?.id === v.id
                                ? "border-primary bg-primary-soft text-primary"
                                : "border-border bg-surface-card text-text-secondary hover:border-border-hover"
                            }`}
                          >
                            {v.size_name} - {formatNumber(v.price)}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Option groups selection */}
                  {selectedNewVariant && (
                    <OptionGroupPicker
                      groups={optionGroupsForProduct(selectedNewProduct.id, optionGroups, optionGroupLinks, modifiers)}
                      picks={selectedNewModifiers}
                      onChange={setSelectedNewModifiers}
                    />
                  )}

                  {/* Qty + price summary */}
                  {selectedNewVariant && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-secondary">SL:</span>
                        <div className="flex items-center gap-1 bg-surface-card rounded-lg p-1 border border-border">
                          <button
                            type="button"
                            onClick={() => setNewQty(Math.max(1, newQty - 1))}
                            className="w-8 h-8 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page"
                          >
                            -
                          </button>
                          <span className="font-bold w-6 text-center text-text-primary">{newQty}</span>
                          <button
                            type="button"
                            onClick={() => setNewQty(newQty + 1)}
                            className="w-8 h-8 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">
                          {formatNumber(
                            (Number(selectedNewVariant.price) +
                              selectedNewModifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0)) *
                              newQty
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSelectedNewProduct(null);
                        setSelectedNewVariant(null);
                        setSelectedNewModifiers([]);
                      }}
                      className="flex-1 min-h-[44px] md:min-h-[40px]"
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={confirmAddProduct}
                      disabled={!selectedNewVariant}
                      className="flex-1 min-h-[44px] md:min-h-[40px]"
                    >
                      Thêm vào đơn
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full border-dashed min-h-[44px] md:min-h-[40px]"
              onClick={() => setIsAddingProduct(true)}
            >
              + Thêm sản phẩm
            </Button>
          )}
        </div>

        {/* Totals, reason, actions */}
        <div
          data-testid="form-money"
          className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden lg:col-start-3 lg:sticky lg:top-4"
        >
          <div className="px-4 py-3 bg-page space-y-3">
            <DiscountEditor
              orderDiscount={orderDiscount}
              orderDiscountType={orderDiscountType}
              setOrderDiscount={setOrderDiscount}
              setOrderDiscountType={setOrderDiscountType}
            />
            {/* Payment Section (BR-SALE-013) */}
            <div className="space-y-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-text-secondary">Thanh toán</span>
                {payments.length === 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddPaymentPart}
                    className="text-xs min-h-[36px] py-1 px-3"
                  >
                    Thêm cách trả
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {payments.map((part, idx) => (
                  <div
                    key={`payment-part-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <div className="w-full sm:flex-1">
                      <Select
                        aria-label={
                          payments.length === 2
                            ? `Phương thức thanh toán ${idx + 1}`
                            : "Phương thức thanh toán"
                        }
                        value={part.method}
                        onChange={(e) =>
                          handleMethodChange(idx, e.target.value as "CASH" | "BANK_TRANSFER")
                        }
                      >
                        <option
                          value="CASH"
                          disabled={payments.length === 2 && payments[1 - idx]?.method === "CASH"}
                        >
                          Tiền mặt
                        </option>
                        <option
                          value="BANK_TRANSFER"
                          disabled={
                            payments.length === 2 && payments[1 - idx]?.method === "BANK_TRANSFER"
                          }
                        >
                          Chuyển khoản
                        </option>
                      </Select>
                    </div>

                    {payments.length === 2 ? (
                      <>
                        <div className="w-full sm:flex-1">
                          <NumberInput
                            id={`payment-amount-${idx}`}
                            decimals={0}
                            unit="đ"
                            min={0}
                            value={part.amount}
                            onValueChange={(v) => handleAmountChange(idx, v ?? 0)}
                            aria-label={`Số tiền ${
                              part.method === "CASH" ? "tiền mặt" : "chuyển khoản"
                            }`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleRemovePaymentPart(idx)}
                          aria-label={`Xoá ${
                            part.method === "CASH" ? "tiền mặt" : "chuyển khoản"
                          }`}
                          className="w-full sm:w-auto px-3 min-h-[44px] md:min-h-[40px] shrink-0"
                        >
                          Xoá
                        </Button>
                      </>
                    ) : (
                      <div className="w-full sm:w-auto text-sm font-semibold text-text-primary text-right tabular-nums py-2 px-1 shrink-0">
                        {formatNumber(totalAmount)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {payments.length === 2 && (
                <div className="space-y-1 pt-1">
                  <div className="text-xs text-text-secondary">
                    Tổng các phần: {formatNumber(totalParts)} • Tiền đơn: {formatNumber(totalAmount)}
                  </div>
                  {totalParts !== totalAmount && (
                    <div role="alert" className="text-xs font-semibold text-danger">
                      Còn lệch {formatNumber(Math.abs(totalParts - totalAmount))}
                    </div>
                  )}
                  {totalParts === totalAmount && payments.some((p) => p.amount <= 0) && (
                    <div role="alert" className="text-xs font-semibold text-danger">
                      Số tiền mỗi phần phải lớn hơn 0
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 flex justify-between items-center bg-surface-card border-t border-border">
            <span className="font-bold text-text-primary">Tổng cộng</span>
            <span className="text-xl font-black text-primary">{formatNumber(totalAmount)}</span>
          </div>

          <div className="px-4 py-3 bg-page border-t border-border">
            <label htmlFor="edit-order-reason" className="block text-xs font-bold text-text-secondary mb-1.5">
              Lý do chỉnh sửa (bắt buộc)
            </label>
            <textarea
              id="edit-order-reason"
              aria-label="Lý do chỉnh sửa"
              placeholder="Ví dụ: Khách đổi từ 1 ly thành 2 ly"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div className="p-4 flex flex-col gap-3 bg-surface-card border-t border-border">
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving || items.length === 0 || !editReason.trim() || !isPaymentValid}
              className="w-full min-h-[44px] md:min-h-[40px]"
            >
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(viewUrl)}
              disabled={isSaving}
              className="w-full min-h-[44px] md:min-h-[40px]"
            >
              Bỏ
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
