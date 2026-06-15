"use client";

import { useState, useMemo } from "react";
import { submitOrder } from "@/app/actions/pos";
import Link from "next/link";

export default function POSScreen({
  brandId,
  categories,
  products,
  variants,
  modifiers,
  promotions = []
}: {
  brandId?: string;
  categories: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  promotions?: any[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  // Product Selection Modal State
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>([]);
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const [itemDiscountType, setItemDiscountType] = useState<"VND" | "PERCENT">("VND");

  // Promotions State
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [manualPromoError, setManualPromoError] = useState<string | null>(null);

  // Cashier Custom Override State
  const [userCustomDiscount, setUserCustomDiscount] = useState<number | null>(null);
  const [userCustomDiscountType, setUserCustomDiscountType] = useState<"VND" | "PERCENT">("VND");

  // Checkout Modal State
  const [modalDiscountInput, setModalDiscountInput] = useState<number | null>(null);
  const [modalDiscountType, setModalDiscountType] = useState<"VND" | "PERCENT">("VND");

  // Group modifiers by group_name
  const groupedModifiers = useMemo(() => {
    const groups: any = {};
    modifiers.forEach((m: any) => {
      if (!groups[m.group_name]) groups[m.group_name] = [];
      groups[m.group_name].push(m);
    });
    return groups;
  }, [modifiers]);

  const filteredProducts = activeCategory === "ALL"
    ? products
    : products.filter((p: any) => p.category_id === activeCategory);

  const openProductModal = (product: any, editIndex: number | null = null) => {
    const prodVariants = variants.filter((v: any) => v.product_id === product.id);
    if (prodVariants.length === 0) return alert("Món này chưa cấu hình kích cỡ & giá.");

    setSelectedProduct(product);
    setEditingCartIndex(editIndex);

    if (editIndex !== null) {
      const item = cart[editIndex];
      setSelectedVariant(prodVariants.find((v: any) => v.id === item.variant_id) || prodVariants[0]);
      setSelectedModifiers([...item.modifiers]);
      setSelectedQty(item.qty);
      setItemDiscount(item.discount_amount || 0);
      setItemDiscountType(item.discount_type || "VND");
    } else {
      setSelectedVariant(prodVariants[0]);
      setSelectedModifiers([]);
      setSelectedQty(1);
      setItemDiscount(0);
      setItemDiscountType("VND");
    }
  };

  const addModifier = (mod: any) => {
    setSelectedModifiers([...selectedModifiers, mod]);
  };

  const removeModifier = (mod: any) => {
    const index = selectedModifiers.findIndex(m => m.id === mod.id);
    if (index !== -1) {
      const newModifiers = [...selectedModifiers];
      newModifiers.splice(index, 1);
      setSelectedModifiers(newModifiers);
    }
  };

  const addToCart = () => {
    if (!selectedVariant) return;

    const cartItem = {
      id: editingCartIndex !== null ? cart[editingCartIndex].id : Date.now().toString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      variant_id: selectedVariant.id,
      size_name: selectedVariant.size_name,
      unit_price: Number(selectedVariant.price),
      modifiers: selectedModifiers,
      qty: selectedQty,
      discount_amount: itemDiscount,
      discount_type: itemDiscountType
    };

    if (editingCartIndex !== null) {
      const newCart = [...cart];
      newCart[editingCartIndex] = cartItem;
      setCart(newCart);
    } else {
      setCart([...cart, cartItem]);
    }

    setSelectedProduct(null);
    setEditingCartIndex(null);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const changeQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].qty += delta;
    if (newCart[index].qty <= 0) {
      removeFromCart(index);
    } else {
      setCart(newCart);
    }
  };

  // Tính toán giá tiền trực tiếp cho món đang chọn trong Popup
  const currentItemBasePrice = selectedVariant ? Number(selectedVariant.price) + selectedModifiers.reduce((sum, m) => sum + Number(m.price), 0) : 0;
  const currentItemBaseTotal = currentItemBasePrice * selectedQty;
  let currentItemDiscountAmount = 0;
  if (itemDiscount > 0) {
    if (itemDiscountType === "PERCENT") {
      currentItemDiscountAmount = (currentItemBaseTotal * itemDiscount) / 100;
    } else {
      currentItemDiscountAmount = itemDiscount;
    }
  }
  const currentItemFinalTotal = Math.max(0, currentItemBaseTotal - currentItemDiscountAmount);

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

  const calculateCartBaseTotal = () => cart.reduce((sum, item) => {
    const modsPrice = item.modifiers.reduce((mSum: number, m: any) => mSum + Number(m.price), 0);
    return sum + (item.unit_price + modsPrice) * item.qty;
  }, 0);

  const calculateSubtotal = () => cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  // Promotions Memo
  const { appliedPromo, promoDiscountAmount } = useMemo(() => {
    const now = new Date();
    const subtotal = calculateSubtotal();
    
    if (cart.length === 0) {
      return { appliedPromo: null, promoDiscountAmount: 0 };
    }

    // Filter active promotions for this brand and current date
    const eligiblePromos = (promotions || []).filter((p: any) => {
      if (p.status !== "ACTIVE") return false;
      const isDateValid = new Date(p.start_date) <= now && (!p.end_date || new Date(p.end_date) >= now);
      if (!isDateValid) return false;

      const isBrandValid = !p.brand_id || p.brand_id === brandId;
      if (!isBrandValid) return false;

      return true;
    });

    // Helper to calculate discount amount for a promotion
    const calcPromoDiscount = (p: any) => {
      if (p.type === "ORDER_DISCOUNT") {
        if (subtotal < Number(p.min_order_value || 0)) return 0;

        if (p.discount_type === "PERCENT") {
          return (subtotal * Number(p.discount_value)) / 100;
        } else {
          return Number(p.discount_value);
        }
      } else if (p.type === "PRODUCT_DISCOUNT") {
        if (subtotal < Number(p.min_order_value || 0)) return 0;

        let totalProdDiscount = 0;
        let applicableVariantsMap: Record<string, number> = {};
        let applicableVariantsList: string[] = [];
        let isMap = false;

        try {
          if (p.applicable_products_json) {
            const parsed = JSON.parse(p.applicable_products_json);
            if (Array.isArray(parsed)) {
              applicableVariantsList = parsed;
            } else if (parsed && typeof parsed === "object") {
              applicableVariantsMap = parsed;
              applicableVariantsList = Object.keys(parsed);
              isMap = true;
            }
          }
        } catch (e) {}

        if (applicableVariantsList.length === 0) return 0;

        cart.forEach((item) => {
          if (applicableVariantsList.includes(item.variant_id)) {
            const val = isMap ? Number(applicableVariantsMap[item.variant_id]) : Number(p.discount_value);

            const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
            const itemBaseTotal = (item.unit_price + modsPrice) * item.qty;
            let itemDiscount = 0;
            if (p.discount_type === "PERCENT") {
              itemDiscount = itemBaseTotal * (val / 100);
            } else if (p.discount_type === "FLAT_PRICE") {
              const unitDiscount = Math.max(0, item.unit_price - val);
              itemDiscount = unitDiscount * item.qty;
            } else {
              itemDiscount = val * item.qty;
            }
            totalProdDiscount += Math.min(itemBaseTotal, itemDiscount);
          }
        });

        return totalProdDiscount;
      }
      return 0;
    };

    // Case 1: Cashier has entered a Promo Code
    if (appliedPromoCode) {
      const matchedPromo = eligiblePromos.find(
        (p: any) => p.code && p.code.toUpperCase() === appliedPromoCode.toUpperCase()
      );
      if (matchedPromo) {
        const amt = calcPromoDiscount(matchedPromo);
        return {
          appliedPromo: matchedPromo,
          promoDiscountAmount: amt,
        };
      }
    }

    // Case 2: Best automatic promotion (code is empty)
    const autoPromos = eligiblePromos.filter((p: any) => !p.code);
    let bestPromo: any = null;
    let maxDiscount = 0;

    autoPromos.forEach((p: any) => {
      const amt = calcPromoDiscount(p);
      if (amt > maxDiscount) {
        maxDiscount = amt;
        bestPromo = p;
      }
    });

    if (bestPromo && maxDiscount > 0) {
      return {
        appliedPromo: bestPromo,
        promoDiscountAmount: maxDiscount,
      };
    }

    return { appliedPromo: null, promoDiscountAmount: 0 };
  }, [cart, promotions, brandId, appliedPromoCode]);

  const handleApplyPromoCode = () => {
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    const matchedPromo = (promotions || []).find(
      (p: any) => p.code && p.code.toUpperCase() === code
    );

    if (!matchedPromo) {
      setManualPromoError("Mã giảm giá không tồn tại hoặc đã bị tắt.");
      return;
    }

    if (matchedPromo.status !== "ACTIVE") {
      setManualPromoError("Chương trình khuyến mãi này không còn hoạt động.");
      return;
    }

    const now = new Date();
    const isStarted = new Date(matchedPromo.start_date) <= now;
    const isExpired = matchedPromo.end_date && new Date(matchedPromo.end_date) < now;

    if (!isStarted) {
      setManualPromoError("Chương trình khuyến mãi chưa bắt đầu.");
      return;
    }
    if (isExpired) {
      setManualPromoError("Mã giảm giá này đã hết hạn.");
      return;
    }

    if (matchedPromo.brand_id && matchedPromo.brand_id !== brandId) {
      setManualPromoError("Mã giảm giá này không áp dụng cho thương hiệu này.");
      return;
    }

    const subtotal = calculateSubtotal();
    if (subtotal < Number(matchedPromo.min_order_value || 0)) {
      setManualPromoError(
        `Đơn hàng chưa đạt giá trị tối thiểu ${Number(matchedPromo.min_order_value).toLocaleString()}đ để áp dụng.`
      );
      return;
    }

    if (matchedPromo.type === "PRODUCT_DISCOUNT") {
      let applicableVariants: string[] = [];
      try {
        if (matchedPromo.applicable_products_json) {
          applicableVariants = JSON.parse(matchedPromo.applicable_products_json);
        }
      } catch (e) {}

      const hasMatchingProduct = cart.some((item) =>
        applicableVariants.includes(item.variant_id)
      );

      if (!hasMatchingProduct) {
        setManualPromoError("Đơn hàng không chứa sản phẩm được áp dụng mã giảm giá này.");
        return;
      }
    }

    setAppliedPromoCode(code);
    setManualPromoError(null);
    setUserCustomDiscount(null);
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCodeInput("");
    setManualPromoError(null);
    setUserCustomDiscount(null);
  };

  const calculateTotalAmount = () => {
    const subtotal = calculateSubtotal();
    let discount = 0;
    if (userCustomDiscount !== null) {
      if (userCustomDiscountType === "PERCENT") {
        discount = (subtotal * userCustomDiscount) / 100;
      } else {
        discount = userCustomDiscount;
      }
    } else {
      discount = promoDiscountAmount;
    }
    return Math.max(0, subtotal - discount);
  };

  const totalAmount = calculateTotalAmount();

  const handleCheckoutClick = () => {
    if (cart.length === 0) return;
    
    // Initialize modal input values based on custom override or promo
    if (userCustomDiscount !== null) {
      setModalDiscountInput(userCustomDiscount);
      setModalDiscountType(userCustomDiscountType);
    } else if (appliedPromo) {
      if (appliedPromo.type === "ORDER_DISCOUNT") {
        setModalDiscountInput(Number(appliedPromo.discount_value));
        setModalDiscountType(appliedPromo.discount_type);
      } else {
        setModalDiscountInput(promoDiscountAmount);
        setModalDiscountType("VND");
      }
    } else {
      setModalDiscountInput(0);
      setModalDiscountType("VND");
    }

    setIsCheckoutModalOpen(true);
  };

  const handleConfirmCheckout = async (method: string) => {
    setIsCheckingOut(true);

    const subtotal = calculateSubtotal();

    let finalDiscountAmountInVND = 0;
    if (userCustomDiscount !== null) {
      // Manual Order Discount from the checkout modal - Order-Level only
      if (userCustomDiscountType === "PERCENT") {
        finalDiscountAmountInVND = subtotal * (userCustomDiscount / 100);
      } else {
        finalDiscountAmountInVND = userCustomDiscount;
      }
    } else if (appliedPromo?.type === "ORDER_DISCOUNT") {
      // ORDER_DISCOUNT promo - Order-Level only
      if (appliedPromo.discount_type === "PERCENT") {
        finalDiscountAmountInVND = subtotal * (Number(appliedPromo.discount_value) / 100);
      } else {
        finalDiscountAmountInVND = Number(appliedPromo.discount_value);
      }
    }
    // PRODUCT_DISCOUNT promo case: finalDiscountAmountInVND stays 0.
    // The promo saving is captured in Order_Lines.line_discount via finalCart above;
    // writing it again to order.discount_amount would cause Reports to double-apply
    // (once via line.line_discount, once via order_discount_ratio).

    const finalAppliedPromoId = userCustomDiscount !== null ? "" : (appliedPromo ? appliedPromo.id : "");
    const finalAppliedPromoSnapshot = userCustomDiscount !== null ? "" : (appliedPromo ? JSON.stringify(appliedPromo) : "");
    const finalDiscountReason = userCustomDiscount !== null ? "MANUAL_DISCOUNT" : "";

    // Item-Level discounts only:
    //   - Cashier-entered per-item discount from the product popup (preserved verbatim)
    //   - PRODUCT_DISCOUNT promo (added on top, capped at itemBaseTotal)
    // Order-Level discounts (manual modal entry or ORDER_DISCOUNT promo) live ONLY in
    // orderData.discount_amount and must NOT be prorated into line_discount.
    const isOrderLevelDiscountActive =
      userCustomDiscount !== null || (appliedPromo?.type === "ORDER_DISCOUNT");

    const finalCart = cart.map(item => {
      const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
      const itemBaseTotal = (item.unit_price + modsPrice) * item.qty;

      // Start from the cashier-entered item discount (already in VND in cart state)
      let lineDiscount = Number(item.discount_amount || 0);

      if (!isOrderLevelDiscountActive && appliedPromo?.type === "PRODUCT_DISCOUNT") {
        // Accumulate the promo discount on top of the cashier discount
        let applicableVariantsMap: Record<string, number> = {};
        let applicableVariantsList: string[] = [];
        let isMap = false;
        try {
          if (appliedPromo.applicable_products_json) {
            const parsed = JSON.parse(appliedPromo.applicable_products_json);
            if (Array.isArray(parsed)) {
              applicableVariantsList = parsed;
            } else if (parsed && typeof parsed === "object") {
              applicableVariantsMap = parsed;
              applicableVariantsList = Object.keys(parsed);
              isMap = true;
            }
          }
        } catch (e) {}

        if (applicableVariantsList.includes(item.variant_id)) {
          const val = isMap
            ? Number(applicableVariantsMap[item.variant_id])
            : Number(appliedPromo.discount_value);
          let promoItemDiscount = 0;
          if (appliedPromo.discount_type === "PERCENT") {
            promoItemDiscount = itemBaseTotal * (val / 100);
          } else if (appliedPromo.discount_type === "FLAT_PRICE") {
            const unitDiscount = Math.max(0, item.unit_price - val);
            promoItemDiscount = unitDiscount * item.qty;
          } else {
            promoItemDiscount = val * item.qty;
          }
          // Cap the combined discount at the item's base total so revenue never goes negative
          lineDiscount = Math.min(itemBaseTotal, lineDiscount + promoItemDiscount);
        }
      }

      return {
        ...item,
        discount_amount: lineDiscount,
        discount_type: "VND",
      };
    });

    const orderData = {
      brand_id: brandId,
      items: finalCart,
      total_amount: totalAmount,
      subtotal_amount: subtotal,
      discount_amount: finalDiscountAmountInVND,
      discount_type: "VND",
      applied_promotion_id: finalAppliedPromoId,
      applied_promotion_snapshot_json: finalAppliedPromoSnapshot,
      discount_reason: finalDiscountReason,
      payment_method: method
    };

    const res = await submitOrder(orderData);
    setIsCheckingOut(false);
    setIsCheckoutModalOpen(false);

    if (res.success) {
      setSuccessOrderNo(res.order_no || "");
      setCart([]);
      setIsCartOpen(false);
      setUserCustomDiscount(null);
      setUserCustomDiscountType("VND");
      setAppliedPromoCode(null);
      setPromoCodeInput("");
      setManualPromoError(null);
    } else {
      alert("Lỗi thanh toán: " + res.error);
    }
  };

  return (
    <div className="fixed inset-0 flex bg-gray-100 font-sans overflow-hidden">

      {/* LEFT: Menu Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="bg-white h-auto min-h-[3.5rem] border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <h1 className="font-bold text-lg text-gray-800">POS Thu Ngân</h1>
          </div>
          <div className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {new Date().toLocaleDateString("vi-VN")}
          </div>
        </header>

        {/* Categories (Horizontal Scroll on Mobile) */}
        <div className="bg-white border-b border-gray-200 p-3 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
            <button
              onClick={() => setActiveCategory("ALL")}
              className={`snap-start whitespace-nowrap px-4 py-2 rounded-xl font-medium text-sm transition-colors ${activeCategory === "ALL" ? "bg-orange-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              Tất cả món
            </button>
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`snap-start whitespace-nowrap px-4 py-2 rounded-xl font-medium text-sm transition-colors ${activeCategory === c.id ? "bg-orange-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredProducts.map((p: any) => (
              <button
                key={p.id}
                onClick={() => openProductModal(p)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition active:scale-95 text-left h-48"
              >
                <div className="h-28 bg-gray-50 flex items-center justify-center border-b border-gray-100 w-full shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-3xl">🥤</div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{p.name}</h3>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart Area (Desktop only, hidden on mobile unless toggled) */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isCartOpen ? "translate-x-0" : "translate-x-full"}`}>

        <div className="h-14 bg-indigo-600 flex items-center justify-between px-4 shrink-0 text-white">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Hoá Đơn
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="lg:hidden p-1 bg-white/20 rounded hover:bg-white/30">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              <p>Chưa có món nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, idx) => {
                const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
                const baseTotal = (item.unit_price + modsPrice) * item.qty;
                const finalTotal = calculateItemTotal(item);

                return (
                  <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-indigo-300">
                    <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => openProductModal(products.find((p: any) => p.id === item.product_id), idx)}>
                      <div>
                        <h4 className="font-bold text-gray-800 leading-tight hover:text-indigo-600 transition-colors">{item.product_name} ✏️</h4>
                        <p className="text-xs font-semibold text-indigo-600 mt-0.5">Size {item.size_name}</p>
                      </div>
                      <div className="text-right">
                        {item.discount_amount > 0 && (
                          <div className="text-[11px] text-gray-400 line-through mb-0.5">
                            {baseTotal.toLocaleString('vi-VN')}
                          </div>
                        )}
                        <div className="font-bold text-orange-600">
                          {finalTotal.toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>

                    {item.modifiers.length > 0 && (
                      <div className="text-[11px] text-gray-500 bg-gray-50 p-1.5 rounded mb-2 leading-relaxed">
                        {Object.entries(
                          item.modifiers.reduce((acc: any, m: any) => {
                            acc[m.name] = (acc[m.name] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([name, count]: [string, any]) => `${count > 1 ? count + ' x ' : ''}${name}`).join(", ")}
                      </div>
                    )}

                    {item.discount_amount > 0 && (
                      <div className="text-[11px] text-red-500 font-medium mb-2">
                        Đã chiết khấu: -{item.discount_type === "PERCENT" ? `${item.discount_amount}%` : `${Number(item.discount_amount).toLocaleString('vi-VN')}đ`}
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-2">
                      <button onClick={() => removeFromCart(idx)} className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100">Xoá</button>
                      <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                        <button onClick={() => changeQty(idx, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold">-</button>
                        <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(idx, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold">+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {/* Promotions Input and Display */}
          {cart.length > 0 && (
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
                    setManualPromoError(null);
                  }}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 uppercase font-medium"
                />
                <button
                  type="button"
                  onClick={handleApplyPromoCode}
                  className="px-4 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg hover:bg-indigo-100 transition active:scale-95 shrink-0"
                >
                  Áp dụng
                </button>
              </div>

              {manualPromoError && (
                <p className="text-red-500 text-xs mt-1.5 font-semibold">⚠️ {manualPromoError}</p>
              )}

              {appliedPromo && (
                <div className="mt-3 flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl p-2.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5">{appliedPromo.code ? "🎟️" : "⚡"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">{appliedPromo.name}</p>
                      <p className="text-[10px] font-medium text-gray-400">
                        Giảm -{promoDiscountAmount.toLocaleString("vi-VN")}đ
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
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-500 font-medium">Tổng tiền ({totalItems} món)</span>
            <div className="text-right">
              {calculateCartBaseTotal() > totalAmount && (
                <div className="text-sm text-gray-400 line-through mb-0.5 font-medium">
                  {calculateCartBaseTotal().toLocaleString('vi-VN')} đ
                </div>
              )}
              <div className="text-2xl font-black text-orange-600">
                {totalAmount.toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>
          <button
            onClick={handleCheckoutClick}
            disabled={cart.length === 0 || isCheckingOut}
            className="w-full bg-indigo-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
          >
            <>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              THANH TOÁN
            </>
          </button>
        </div>
      </div>

      {/* Mobile Floating Cart Button */}
      {!isCartOpen && cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 font-bold active:scale-95 transition-transform z-30"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-indigo-600">{totalItems}</span>
          </div>
          <span>{totalAmount.toLocaleString('vi-VN')} đ</span>
        </button>
      )}

      {/* Product Selection Modal (Popup Chọn Món) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full sm:w-[500px] max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-white">
              {/* SIZE SELECTION */}
              <div>
                <h4 className="font-bold text-sm text-gray-800 mb-3 uppercase">Chọn Kích Cỡ</h4>
                <div className="grid grid-cols-2 gap-3">
                  {variants.filter((v: any) => v.product_id === selectedProduct.id).map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedVariant?.id === v.id ? "border-orange-500 bg-orange-50" : "border-gray-100 bg-white hover:border-orange-200"}`}
                    >
                      <span className={`font-bold text-sm ${selectedVariant?.id === v.id ? "text-orange-700" : "text-gray-700"}`}>{v.size_name}</span>
                      <span className="text-sm font-black text-gray-900">{Number(v.price).toLocaleString('vi-VN')}đ</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODIFIERS (TOPPINGS, SUGAR, ICE) */}
              {Object.keys(groupedModifiers).map(groupName => (
                <div key={groupName}>
                  <h4 className="font-bold text-sm text-gray-800 mb-3 uppercase">{groupName}</h4>
                  <div className="flex flex-col gap-2">
                    {groupedModifiers[groupName].map((mod: any) => {
                      const count = selectedModifiers.filter(m => m.id === mod.id).length;
                      return (
                        <div key={mod.id} className={`flex justify-between items-center px-4 py-3 rounded-xl border transition-all ${count > 0 ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                          <div className="flex flex-col">
                            <span className={`text-sm ${count > 0 ? "text-indigo-700 font-bold" : "text-gray-700 font-medium"}`}>{mod.name}</span>
                            {Number(mod.price) > 0 && (
                              <span className="text-xs text-gray-500 mt-0.5">+{Number(mod.price).toLocaleString('vi-VN')}đ</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => removeModifier(mod)}
                              disabled={count === 0}
                              className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${count > 0 ? "bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 shadow-sm" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                            >
                              -
                            </button>
                            <span className={`font-bold w-4 text-center ${count > 0 ? "text-indigo-800" : "text-gray-500"}`}>
                              {count}
                            </span>
                            <button
                              onClick={() => addModifier(mod)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-100 font-bold text-lg transition-colors shadow-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">

              {/* CHIẾT KHẤU MÓN (Dời xuống footer) */}
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-sm text-gray-800 whitespace-nowrap">Chiết khấu:</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0 h-10">
                    <button
                      onClick={() => setItemDiscountType("VND")}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      VNĐ
                    </button>
                    <button
                      onClick={() => setItemDiscountType("PERCENT")}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
                    >
                      %
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Nhập số..."
                    value={itemDiscount || ""}
                    onChange={(e) => setItemDiscount(Number(e.target.value))}
                    className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none h-10 text-right"
                  />
                </div>
              </div>

              {/* TỔNG TIỀN & NÚT CẬP NHẬT */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1.5 shrink-0 h-14">
                  <button
                    onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 font-bold text-xl hover:text-orange-600 transition-colors"
                  >
                    -
                  </button>
                  <span className="text-lg font-black w-6 text-center text-gray-800">{selectedQty}</span>
                  <button
                    onClick={() => setSelectedQty(selectedQty + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 font-bold text-xl hover:text-orange-600 transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={addToCart}
                  className="flex-1 bg-orange-600 text-white py-2 px-3 rounded-xl hover:bg-orange-700 active:scale-[0.98] transition-all flex flex-col items-center justify-center h-14"
                >
                  <div className="font-bold text-sm lg:text-base">
                    {editingCartIndex !== null ? "CẬP NHẬT" : "THÊM"} - {currentItemFinalTotal.toLocaleString('vi-VN')} đ
                  </div>
                  {currentItemDiscountAmount > 0 && (
                    <div className="text-[10px] lg:text-xs text-orange-200 line-through font-medium">
                      Gốc: {currentItemBaseTotal.toLocaleString('vi-VN')} đ
                    </div>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-900">Chọn phương thức</h3>
              <button
                onClick={() => !isCheckingOut && setIsCheckoutModalOpen(false)}
                className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 disabled:opacity-50"
                disabled={isCheckingOut}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 bg-white space-y-4">
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-1">Tạm Tính</p>
                <div className="text-xl font-bold text-gray-700 line-through">{calculateSubtotal().toLocaleString('vi-VN')} đ</div>
                <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-left">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Chiết khấu đơn hàng</label>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                      <button
                        onClick={() => {
                          setModalDiscountType("VND");
                          setUserCustomDiscount(modalDiscountInput);
                          setUserCustomDiscountType("VND");
                        }}
                        className={`px-3 py-2 text-sm font-bold transition-colors ${modalDiscountType === "VND" ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-500 hover:bg-gray-100"}`}
                      >
                        VNĐ
                      </button>
                      <button
                        onClick={() => {
                          setModalDiscountType("PERCENT");
                          setUserCustomDiscount(modalDiscountInput);
                          setUserCustomDiscountType("PERCENT");
                        }}
                        className={`px-3 py-2 text-sm font-bold transition-colors ${modalDiscountType === "PERCENT" ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-500 hover:bg-gray-100"}`}
                      >
                        %
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="Nhập giảm giá..."
                      value={modalDiscountInput === 0 ? "" : modalDiscountInput || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setModalDiscountInput(val);
                        setUserCustomDiscount(val);
                        setUserCustomDiscountType(modalDiscountType);
                      }}
                      className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right font-medium"
                    />
                  </div>
                  {userCustomDiscount !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserCustomDiscount(null);
                        if (appliedPromo) {
                          if (appliedPromo.type === "ORDER_DISCOUNT") {
                            setModalDiscountInput(Number(appliedPromo.discount_value));
                            setModalDiscountType(appliedPromo.discount_type);
                          } else {
                            setModalDiscountInput(promoDiscountAmount);
                            setModalDiscountType("VND");
                          }
                        } else {
                          setModalDiscountInput(0);
                          setModalDiscountType("VND");
                        }
                      }}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 w-full text-center"
                    >
                      🔄 Khôi phục khuyến mãi hệ thống
                    </button>
                  )}
                </div>
                <p className="text-sm text-indigo-600 uppercase font-black tracking-wider mb-1 mt-6">Khách Phải Trả</p>
                <div className="text-4xl font-black text-orange-600">{totalAmount.toLocaleString('vi-VN')} đ</div>
              </div>

              <button
                onClick={() => handleConfirmCheckout("Tien mat")}
                disabled={isCheckingOut}
                className="w-full bg-emerald-50 text-emerald-700 border-2 border-emerald-200 font-bold text-lg py-4 rounded-xl hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                <span className="text-2xl">💵</span>
                <span>Tiền mặt</span>
              </button>

              <button
                onClick={() => handleConfirmCheckout("Chuyen khoan")}
                disabled={isCheckingOut}
                className="w-full bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold text-lg py-4 rounded-xl hover:bg-blue-100 hover:border-blue-300 active:scale-[0.98] transition-all flex justify-center items-center gap-3 disabled:opacity-50"
              >
                <span className="text-2xl">💳</span>
                <span>Chuyển khoản (QR)</span>
              </button>

              {isCheckingOut && (
                <div className="text-center text-sm font-medium text-indigo-600 pt-2 animate-pulse">
                  Đang ghi nhận đơn hàng...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successOrderNo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
                &#10003;
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thanh toan thanh cong!</h3>
              <p className="text-sm text-gray-500 mb-3">Ma don hang</p>
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4">
                <span className="text-3xl font-black text-orange-600 tracking-wider">{successOrderNo}</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setSuccessOrderNo(null)}
                className="w-full bg-indigo-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                Tao don moi
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}
