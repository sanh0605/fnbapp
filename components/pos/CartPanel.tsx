"use client";

import { DiscountBadge, DISCOUNT_KIND } from "./DiscountBadge";
import { CartItemRow } from "./CartItemRow";
import { formatNumber } from "@/lib/format";
import { alert, confirm } from "@/lib/dialog";

interface CartPanelProps {
  cart: any[];
  products: any[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  saveDraft: (cart: any[], clearCartAfter: boolean) => void;
  drafts: any[];
  setCart: (cart: any[]) => void;
  setActiveDraftId: (id: string | null) => void;
  activeDraftId: string | null;
  openProductModal: (product: any, idx: number) => void;
  removeFromCart: (idx: number) => void;
  changeQty: (idx: number, delta: number) => void;
  promoCodeInput: string;
  setPromoCodeInput: (val: string) => void;
  handleApplyPromoCode: () => void;
  handleRemovePromoCode: () => void;
  appliedPromo: any;
  promoDiscountAmount: number;
  manualPromoError: string | null;
  userCustomDiscountType: "VND" | "PERCENT";
  setUserCustomDiscountType: (type: "VND" | "PERCENT") => void;
  userCustomDiscount: number | null;
  setUserCustomDiscount: (val: number | null) => void;
  handleConfirmCheckout: (method: string) => void;
  isCheckingOut: string | null;
  itemPromoDiscounts: number[];
  isOnline: boolean;
  processingOrder: any | null;
  lastCheckoutError: any | null;
  clearLastCheckoutError: () => void;
}

export function CartPanel({
  cart,
  products,
  isCartOpen,
  setIsCartOpen,
  saveDraft,
  drafts,
  setCart,
  setActiveDraftId,
  activeDraftId,
  openProductModal,
  removeFromCart,
  changeQty,
  promoCodeInput,
  setPromoCodeInput,
  handleApplyPromoCode,
  handleRemovePromoCode,
  appliedPromo,
  promoDiscountAmount,
  manualPromoError,
  userCustomDiscountType,
  setUserCustomDiscountType,
  userCustomDiscount,
  setUserCustomDiscount,
  handleConfirmCheckout,
  isCheckingOut,
  itemPromoDiscounts,
  isOnline,
  processingOrder,
  lastCheckoutError,
  clearLastCheckoutError,
}: CartPanelProps) {
  const calculateItemTotal = (item: any) => {
    const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
    const baseTotal = (item.unit_price + modsPrice) * item.qty;
    let discount = 0;
    if (item.discount_amount > 0) {
      if (item.discount_type === "PERCENT") {
        discount = (baseTotal * item.discount_amount) / 100;
      } else {
        discount = item.discount_amount;
      }
    }
    return Math.max(0, baseTotal - discount);
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const calculateCartBaseTotal = () =>
    cart.reduce((sum, item) => {
      const modsPrice = item.modifiers.reduce((mSum: number, m: any) => mSum + Number(m.price), 0);
      return sum + (item.unit_price + modsPrice) * item.qty;
    }, 0);

  const calculateTotalAmount = () => {
    const subtotal = calculateSubtotal();

    let orderLevelDiscount = 0;
    if (userCustomDiscount !== null) {
      if (userCustomDiscountType === "PERCENT") {
        orderLevelDiscount = (subtotal * userCustomDiscount) / 100;
      } else {
        orderLevelDiscount = userCustomDiscount;
      }
    } else if (appliedPromo?.type === "ORDER_DISCOUNT") {
      orderLevelDiscount = promoDiscountAmount;
    }

    const productLevelDiscount = appliedPromo?.type === "PRODUCT_DISCOUNT" ? promoDiscountAmount : 0;

    return Math.max(0, subtotal - orderLevelDiscount - productLevelDiscount);
  };

  const totalAmount = calculateTotalAmount();

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
        isCartOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="h-14 bg-indigo-600 flex items-center justify-between px-4 shrink-0 text-white">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Hoá Đơn
        </h2>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <>
              <button
                onClick={() => saveDraft(cart, true)}
                className="text-xs font-bold bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
              >
                Lưu Nháp
              </button>
              <button
                onClick={async () => {
                  if (await confirm({ title: "Xác nhận xóa", message: "Xoá hết món trong giỏ hàng?", variant: "danger" })) {
                    setCart([]);
                    setActiveDraftId(null);
                  }
                }}
                className="text-xs font-bold bg-red-500/20 text-red-100 hover:bg-red-500/40 px-2 py-1 rounded transition-colors"
              >
                Xoá hết
              </button>
            </>
          )}
          <button onClick={() => setIsCartOpen(false)} className="lg:hidden p-1 bg-white/20 rounded hover:bg-white/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
        {cart.length === 0 ? (
          processingOrder ? (
            <div className="h-full flex flex-col justify-between">
              <div className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm space-y-4 animate-pulse">
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wide">Đang xử lý đơn hàng...</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Vui lòng chờ trong giây lát</p>
                  </div>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {processingOrder.items.map((item: any, idx: number) => {
                    return (
                      <div key={item.id || idx} className="flex justify-between items-start text-xs border-b border-gray-50 pb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-gray-800 truncate">{item.product_name}</p>
                          <p className="text-[10px] text-gray-400">
                            Size {item.size_name}
                            {item.modifiers.length > 0 && ` • +${item.modifiers.map((m: any) => m.name).join(", ")}`}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium mt-0.5">Số lượng: {item.qty}</p>
                        </div>
                        <span className="font-semibold text-gray-700 shrink-0 ml-2">
                          {formatNumber((item.unit_price + item.modifiers.reduce((s: number, m: any) => s + Number(m.price), 0)) * item.qty)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-dashed border-gray-200 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tạm tính:</span>
                    <span>{formatNumber(processingOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Hình thức:</span>
                    <span className="font-bold text-indigo-600">{processingOrder.methodLabel}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-gray-800 pt-1">
                    <span>Tổng tiền:</span>
                    <span className="text-orange-600">{formatNumber(processingOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-xs text-gray-400 py-4 font-medium animate-fade-in">
                Bạn có thể tạo đơn mới trong khi hệ thống đang xử lý đơn hàng này.
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <p>Chưa có món nào</p>
            </div>
          )
        ) : (
          <div className="space-y-3">
            {cart.map((item, idx) => (
              <CartItemRow
                key={item.id}
                item={item}
                idx={idx}
                products={products}
                itemPromoDiscount={itemPromoDiscounts[idx] || 0}
                openProductModal={openProductModal}
                removeFromCart={removeFromCart}
                changeQty={changeQty}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {lastCheckoutError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold flex items-center justify-between mb-3 animate-fade-in">
            <div className="flex-1 min-w-0">
              <p className="font-bold">⚠️ Lỗi thanh toán ({lastCheckoutError.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"})</p>
              <p className="text-[11px] text-rose-600 mt-0.5 truncate">{lastCheckoutError.error}</p>
            </div>
            <button
              onClick={() => {
                handleConfirmCheckout(lastCheckoutError.method);
                clearLastCheckoutError();
              }}
              className="bg-rose-600 text-white font-extrabold px-3 py-1.5 rounded-lg hover:bg-rose-700 active:scale-95 transition min-h-[44px] min-w-[80px] shrink-0 ml-2 shadow-sm flex items-center justify-center text-xs"
            >
              Thử lại
            </button>
          </div>
        )}

        {cart.length > 0 ? (
          <>
            <div className="mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Khuyến Mãi</span>
                {appliedPromo && (
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Đã áp dụng
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã giảm giá..."
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value);
                  }}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 uppercase font-medium animate-fade-in"
                />
                <button
                  type="button"
                  onClick={handleApplyPromoCode}
                  className="px-4 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 transition active:scale-95 shrink-0"
                >
                  Áp dụng
                </button>
              </div>

              {manualPromoError && <p className="text-red-500 text-xs mt-1.5 font-semibold">⚠️ {manualPromoError}</p>}

              {appliedPromo && (
                <div className="mt-3 flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5">{appliedPromo.code ? "🎟️" : "⚡"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{appliedPromo.name}</p>
                      <p className="text-[10px] font-medium text-gray-400">
                        Giảm -{formatNumber(promoDiscountAmount)}
                      </p>
                    </div>
                  </div>
                  {appliedPromo.code && (
                    <button
                      type="button"
                      onClick={handleRemovePromoCode}
                      className="text-gray-400 hover:text-red-500 text-sm font-bold px-1.5 py-0.5 hover:bg-red-50 rounded animate-fade-in"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Chiết khấu đơn hàng */}
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Chiết khấu đơn hàng</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0 h-9 bg-white">
                    <button
                      type="button"
                      onClick={() => {
                        setUserCustomDiscountType("VND");
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        userCustomDiscountType === "VND"
                          ? "bg-indigo-500 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      VNĐ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUserCustomDiscountType("PERCENT");
                      }}
                      className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                        userCustomDiscountType === "PERCENT"
                          ? "bg-indigo-500 text-white"
                          : "bg-white text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Nhập giảm giá..."
                    value={userCustomDiscount === 0 || userCustomDiscount === null ? "" : userCustomDiscount}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setUserCustomDiscount(val);
                    }}
                    className="flex-1 w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 text-right font-medium text-sm h-9"
                  />
                  {userCustomDiscount !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserCustomDiscount(null);
                      }}
                      className="text-gray-400 hover:text-red-500 text-sm font-bold px-2 py-1.5 hover:bg-red-50 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {userCustomDiscount !== null && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-500 text-sm">Giảm giá Hoá đơn</span>
                <DiscountBadge
                  kind={DISCOUNT_KIND.ORDER}
                  label="Thu ngân"
                  amount={
                    userCustomDiscountType === "PERCENT" ? (calculateSubtotal() * userCustomDiscount) / 100 : userCustomDiscount
                  }
                />
              </div>
            )}

            {appliedPromo &&
              (() => {
                const amount = userCustomDiscount !== null && appliedPromo.type === "ORDER_DISCOUNT" ? 0 : promoDiscountAmount;
                if (amount <= 0) return null;
                return (
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-500 text-sm">Khuyến mãi hệ thống</span>
                    <DiscountBadge kind={DISCOUNT_KIND.PROMO} label="Hệ thống" amount={amount} />
                  </div>
                );
              })()}

            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-medium">Tổng tiền ({totalItems} món)</span>
              <div className="text-right">
                {calculateCartBaseTotal() > totalAmount && (
                  <div className="text-sm text-gray-400 line-through mb-0.5 font-medium">
                    {formatNumber(calculateCartBaseTotal())}
                  </div>
                )}
                <div className="text-2xl font-black text-orange-600">{formatNumber(totalAmount)}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmCheckout("Tien mat")}
                disabled={cart.length === 0 || !!isCheckingOut || !!processingOrder || !isOnline}
                className="flex-1 bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-md hover:bg-emerald-700 active:scale-[0.98] transition-colors transition-transform opacity disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 min-h-[48px]"
              >
                {!isOnline ? (
                  <span>NGOẠI TUYẾN</span>
                ) : isCheckingOut === "Tien mat" ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>ĐANG XỬ LÝ...</span>
                  </>
                ) : processingOrder ? (
                  <span>CHỜ GỬI ĐƠN...</span>
                ) : (
                  <>
                    <span className="text-lg">💵</span>
                    <span>TIỀN MẶT</span>
                  </>
                )}
              </button>
              <button
                onClick={() => handleConfirmCheckout("Chuyen khoan")}
                disabled={cart.length === 0 || !!isCheckingOut || !!processingOrder || !isOnline}
                className="flex-1 bg-blue-600 text-white font-bold text-sm py-3.5 rounded-xl shadow-md hover:bg-blue-700 active:scale-[0.98] transition-colors transition-transform opacity disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2 min-h-[48px]"
              >
                {!isOnline ? (
                  <span>NGOẠI TUYẾN</span>
                ) : isCheckingOut === "Chuyen khoan" ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>ĐANG XỬ LÝ...</span>
                  </>
                ) : processingOrder ? (
                  <span>CHỜ GỬI ĐƠN...</span>
                ) : (
                  <>
                    <span className="text-lg">💳</span>
                    <span>CHUYỂN KHOẢN</span>
                  </>
                )}
              </button>
            </div>
          </>
        ) : processingOrder ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-500 font-medium">Tổng thanh toán ({processingOrder.totalItems} món)</span>
              <span className="text-2xl font-black text-orange-600">{formatNumber(processingOrder.totalAmount)}</span>
            </div>
            <div className="w-full bg-gray-100 text-gray-500 font-bold text-sm py-3.5 rounded-xl flex justify-center items-center gap-2 border border-gray-200 min-h-[48px]">
              <svg className="animate-spin h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>ĐANG GỬI ĐƠN HÀNG ({processingOrder.methodLabel})...</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
