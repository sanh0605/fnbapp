"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { formatNumber } from "@/lib/format";
import { submitOrderV2, getPOSDrafts, savePOSDraft, deletePOSDraft } from "@/app/pos/actions";
import type { CartInput } from "@/lib/order-cart";
import Link from "next/link";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { alert, confirm } from "@/lib/dialog";

export default function POSScreen({
  brandId,
  categories,
  products,
  variants,
  modifiers,
  promotions = [],
  bestSellers = [],
  outOfStockProductIds = []
}: {
  brandId?: string;
  categories: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  promotions?: any[];
  bestSellers?: string[];
  outOfStockProductIds?: string[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>("BEST_SELLERS");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [processingOrder, setProcessingOrder] = useState<any | null>(null);
  const [lastCheckoutError, setLastCheckoutError] = useState<any | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  const addToast = (
    type: "success" | "error" | "warning" | "info",
    message: string,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message, action }]);
    if (type !== "error") {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(window.navigator.onLine);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast("success", "Đã kết nối trực tuyến trở lại.");
    };
    const handleOffline = () => {
      setIsOnline(false);
      addToast("warning", "Mất kết nối internet. POS đang chạy ở chế độ ngoại tuyến.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const refreshDrafts = async () => {
    if (!brandId) return;
    try {
      const data = await getPOSDrafts(brandId);
      const parsed = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        timestamp: new Date(d.timestamp || d.created_at).getTime(),
        cart: JSON.parse(d.cart_json),
        created_by_name: d.created_by_name,
      }));
      setDrafts(parsed);
    } catch (err) {
      console.error(err);
    }
  };

  // Load drafts on mount
  useEffect(() => {
    refreshDrafts();
  }, [brandId]);

  const saveDraft = (cartToSave: any[], clearCartAfter: boolean = false) => {
    if (cartToSave.length === 0) return;
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh'
    });
    const formattedDate = formatter.format(now);
    const firstItemName = cartToSave[0]?.product_name || "Trống";
    const draftName = `${formattedDate} - ${firstItemName}`;

    savePOSDraft({
      id: activeDraftId || undefined,
      name: draftName,
      cart_json: JSON.stringify(cartToSave),
      brand_id: brandId || "",
    }).then(async res => {
      if (res.success && res.draft) {
        refreshDrafts();
        if (clearCartAfter) {
          setCart([]);
          setActiveDraftId(null);
        } else {
          setActiveDraftId(res.draft.id);
        }
      } else {
        await alert({ title: "Lỗi", message: "Lỗi lưu đơn nháp: " + (res as any).error, variant: "danger" });
      }
    });
  };

  const loadDraft = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    
    if (cart.length > 0) {
      if (await confirm({ title: "Xác nhận", message: "Bạn đang có món trong giỏ. Lưu giỏ hiện tại thành nháp mới trước khi mở nháp này?", variant: "warning" })) {
        saveDraft(cart, false);
      }
    }
    
    setCart(draft.cart);
    setActiveDraftId(draftId);
    setIsDraftModalOpen(false);
  };

  const deleteDraft = (draftId: string) => {
    deletePOSDraft(draftId).then(async res => {
      if (res.success) {
        refreshDrafts();
        if (activeDraftId === draftId) {
          setActiveDraftId(null);
        }
      } else {
        await alert({ title: "Lỗi", message: "Lỗi xóa đơn nháp: " + res.error, variant: "danger" });
      }
    });
  };

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

  // Group modifiers by group_name
  const groupedModifiers = useMemo(() => {
    const groups: any = {};
    modifiers.forEach((m: any) => {
      if (!groups[m.group_name]) groups[m.group_name] = [];
      groups[m.group_name].push(m);
    });
    return groups;
  }, [modifiers]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (activeCategory === "BEST_SELLERS") {
      result = products.filter((p: any) => (bestSellers || []).includes(p.id));
      result.sort((a: any, b: any) => (bestSellers || []).indexOf(a.id) - (bestSellers || []).indexOf(b.id));
    } else if (activeCategory !== "ALL") {
      result = products.filter((p: any) => p.category_id === activeCategory);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p: any) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, activeCategory, searchQuery, bestSellers]);

  const { promoProductsMap, promoVariantsMap, promoDetailsMap } = useMemo(() => {
    const prodMap = new Map<string, number>();
    const varMap = new Map<string, number>();
    const detailsMap = new Map<string, any>(); // store promo details for accurate % calc with modifiers
    
    const now = new Date();
    (promotions || []).forEach((p: any) => {
      if (p.status !== "ACTIVE" || p.type !== "PRODUCT_DISCOUNT") return;
      const isDateValid = new Date(p.start_date) <= now && (!p.end_date || new Date(p.end_date) >= now);
      if (!isDateValid) return;
      if (p.brand_id && p.brand_id !== brandId) return;

      let applicableVariantsList: string[] = [];
      let applicableVariantsMap: Record<string, number> = {};
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
      
      applicableVariantsList.forEach(vId => {
        const variant = variants.find((v: any) => v.id === vId);
        if (variant) {
          const basePrice = Number(variant.price);
          const val = isMap ? Number(applicableVariantsMap[vId]) : Number(p.discount_value);
          let newPrice = basePrice;
          
          if (p.discount_type === "PERCENT") {
            newPrice = basePrice * (1 - val / 100);
          } else if (p.discount_type === "FLAT_PRICE") {
            newPrice = val;
          } else {
            newPrice = Math.max(0, basePrice - val);
          }
          
          
          // Store the minimum new price for the product if multiple promos or variants apply
          if (!prodMap.has(variant.product_id) || newPrice < prodMap.get(variant.product_id)!) {
             prodMap.set(variant.product_id, newPrice);
          }
          if (!varMap.has(vId) || newPrice < varMap.get(vId)!) {
             varMap.set(vId, newPrice);
             detailsMap.set(vId, { type: p.discount_type, val });
          }
        }
      });
    });
    return { promoProductsMap: prodMap, promoVariantsMap: varMap, promoDetailsMap: detailsMap };
  }, [promotions, variants, brandId]);

  const openProductModal = async (product: any, editIndex: number | null = null) => {
    const prodVariants = variants.filter((v: any) => v.product_id === product.id);
    if (prodVariants.length === 0) return await alert({ message: "Món này chưa cấu hình kích cỡ & giá." });

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
    setLastCheckoutError(null);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    setLastCheckoutError(null);
  };

  const changeQty = (index: number, delta: number) => {
    const newCart = [...cart];
    newCart[index].qty += delta;
    if (newCart[index].qty <= 0) {
      removeFromCart(index);
    } else {
      setCart(newCart);
    }
    setLastCheckoutError(null);
  };

  const currentItemBasePrice = selectedVariant ? Number(selectedVariant.price) + selectedModifiers.reduce((sum, m) => sum + Number(m.price), 0) : 0;
  const currentItemBaseTotal = currentItemBasePrice * selectedQty;
  let currentItemManualDiscountAmount = 0;
  if (itemDiscount > 0) {
    if (itemDiscountType === "PERCENT") {
      currentItemManualDiscountAmount = (currentItemBaseTotal * itemDiscount) / 100;
    } else {
      currentItemManualDiscountAmount = itemDiscount;
    }
  }

  // Calculate promo discount for the current selection in modal
  let currentItemPromoDiscountAmount = 0;
  if (selectedVariant && promoDetailsMap.has(selectedVariant.id)) {
    const promo = promoDetailsMap.get(selectedVariant.id);
    if (promo.type === "PERCENT") {
      currentItemPromoDiscountAmount = currentItemBaseTotal * (promo.val / 100);
    } else if (promo.type === "FLAT_PRICE") {
      const unitDiscount = Math.max(0, Number(selectedVariant.price) - promo.val);
      currentItemPromoDiscountAmount = unitDiscount * selectedQty;
    } else {
      currentItemPromoDiscountAmount = promo.val * selectedQty;
    }
  }

  const currentItemFinalTotal = Math.max(0, currentItemBaseTotal - currentItemManualDiscountAmount - currentItemPromoDiscountAmount);

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

  const { appliedPromo, promoDiscountAmount } = useMemo(() => {
    const now = new Date();
    const subtotal = calculateSubtotal();
    
    if (cart.length === 0) {
      return { appliedPromo: null, promoDiscountAmount: 0 };
    }

    const eligiblePromos = (promotions || []).filter((p: any) => {
      if (p.status !== "ACTIVE") return false;
      const isDateValid = new Date(p.start_date) <= now && (!p.end_date || new Date(p.end_date) >= now);
      if (!isDateValid) return false;

      const isBrandValid = !p.brand_id || p.brand_id === brandId;
      if (!isBrandValid) return false;

      return true;
    });

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

  const itemPromoDiscounts = useMemo(() => {
    const discounts: number[] = new Array(cart.length).fill(0);
    if (appliedPromo?.type === "PRODUCT_DISCOUNT") {
      let isMap = false;
      let applicableVariantsMap: Record<string, number> = {};
      let applicableVariantsList: string[] = [];
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
      } catch(e) {}

      cart.forEach((item, idx) => {
        if (applicableVariantsList.includes(item.variant_id)) {
          const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
          const baseTotal = (item.unit_price + modsPrice) * item.qty;
          const val = isMap ? Number(applicableVariantsMap[item.variant_id]) : Number(appliedPromo.discount_value);
          let itemDiscount = 0;
          if (appliedPromo.discount_type === "PERCENT") {
            itemDiscount = baseTotal * (val / 100);
          } else if (appliedPromo.discount_type === "FLAT_PRICE") {
            const unitDiscount = Math.max(0, item.unit_price - val);
            itemDiscount = unitDiscount * item.qty;
          } else {
            itemDiscount = val * item.qty;
          }
          discounts[idx] = Math.min(baseTotal, itemDiscount);
        }
      });
    }
    return discounts;
  }, [cart, appliedPromo]);

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
        `Đơn hàng chưa đạt giá trị tối thiểu ${formatNumber(matchedPromo.min_order_value)} để áp dụng.`
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

    const productLevelDiscount = appliedPromo?.type === "PRODUCT_DISCOUNT"
      ? promoDiscountAmount
      : 0;

    return Math.max(0, subtotal - orderLevelDiscount - productLevelDiscount);
  };

  const totalAmount = calculateTotalAmount();



  const handleConfirmCheckout = async (method: string) => {
    if (cart.length === 0 || !isOnline) return;
    setIsCheckingOut(method);
    setLastCheckoutError(null);

    // Save states for rollback
    const cartBackup = [...cart];
    const draftIdBackup = activeDraftId;
    const customDiscountBackup = userCustomDiscount;
    const customDiscountTypeBackup = userCustomDiscountType;
    const appliedPromoCodeBackup = appliedPromoCode;
    const promoCodeInputBackup = promoCodeInput;
    const manualPromoErrorBackup = manualPromoError;

    // Calculate totals
    const currentSubtotal = calculateSubtotal();
    const currentTotalAmount = calculateTotalAmount();
    const currentTotalItems = totalItems;

    const cartInput: CartInput = {
      brand_id: brandId || "",
      items: cart.map(item => {
        let manualItemValue = Number(item.discount_amount || 0);
        let manualItemType: "VND" | "PERCENT" = item.discount_type === "PERCENT" ? "PERCENT" : "VND";

        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: item.qty,
          modifiers: item.modifiers.map((m: any) => ({
            modifier_id: m.id,
            modifier_qty: 1,
          })),
          manual_item_discount: {
            value: manualItemValue,
            type: manualItemType,
          },
        };
      }),
      payment_method: method === "Chuyen khoan" ? "BANK_TRANSFER" : "CASH",
      manual_order_discount: userCustomDiscount !== null
        ? {
            value: userCustomDiscount,
            type: userCustomDiscountType,
          }
        : null,
      applied_promotion_id: appliedPromo?.id || null,
      actor: { id: "", name: "" },
    };

    // Construct optimistic processing order details
    const newProcessingOrder = {
      items: cartBackup,
      totalAmount: currentTotalAmount,
      totalItems: currentTotalItems,
      subtotal: currentSubtotal,
      paymentMethod: method === "Chuyen khoan" ? "BANK_TRANSFER" : "CASH",
      methodLabel: method === "Chuyen khoan" ? "CHUYỂN KHOẢN" : "TIỀN MẶT",
      method,
      cartInput,
      cartBackup,
      draftIdBackup,
      customDiscountBackup,
      customDiscountTypeBackup,
      appliedPromoCodeBackup,
      promoCodeInputBackup,
      manualPromoErrorBackup,
    };

    setProcessingOrder(newProcessingOrder);

    // Optimistically clear cart
    setCart([]);
    setIsCartOpen(false);
    setUserCustomDiscount(null);
    setUserCustomDiscountType("VND");
    setAppliedPromoCode(null);
    setPromoCodeInput("");
    setManualPromoError(null);
    setActiveDraftId(null);

    try {
      const res = await submitOrderV2(cartInput);
      setIsCheckingOut(null);
      setProcessingOrder(null);

      if (res.success) {
        setSuccessOrderNo(res.order_no || "");
        addToast("success", `Thanh toán thành công! Mã đơn: ${res.order_no || ""}`);
        
        if (draftIdBackup) {
          deletePOSDraft(draftIdBackup).then(delRes => {
            if (delRes.success) {
              refreshDrafts();
            }
          });
        }
      } else {
        // Rollback states
        setCart(cartBackup);
        setActiveDraftId(draftIdBackup);
        setUserCustomDiscount(customDiscountBackup);
        setUserCustomDiscountType(customDiscountTypeBackup);
        setAppliedPromoCode(appliedPromoCodeBackup);
        setPromoCodeInput(promoCodeInputBackup);
        setManualPromoError(manualPromoErrorBackup);
        setIsCartOpen(true);

        setLastCheckoutError({
          method,
          error: res.error,
          processingOrder: newProcessingOrder,
        });

        addToast(
          "error",
          `Thanh toán thất bại: ${res.error}`,
          {
            label: "Thử lại",
            onClick: () => {
              handleConfirmCheckout(method);
            }
          }
        );
      }
    } catch (err: any) {
      setIsCheckingOut(null);
      setProcessingOrder(null);

      // Rollback states
      setCart(cartBackup);
      setActiveDraftId(draftIdBackup);
      setUserCustomDiscount(customDiscountBackup);
      setUserCustomDiscountType(customDiscountTypeBackup);
      setAppliedPromoCode(appliedPromoCodeBackup);
      setPromoCodeInput(promoCodeInputBackup);
      setManualPromoError(manualPromoErrorBackup);
      setIsCartOpen(true);

      const errorMsg = err?.message || String(err);
      setLastCheckoutError({
        method,
        error: errorMsg,
        processingOrder: newProcessingOrder,
      });

      addToast(
        "error",
        `Lỗi hệ thống: ${errorMsg}`,
        {
          label: "Thử lại",
          onClick: () => {
            handleConfirmCheckout(method);
          }
        }
      );
    }
  };

  const handleConfirmCheckoutRef = useRef(handleConfirmCheckout);
  useEffect(() => {
    handleConfirmCheckoutRef.current = handleConfirmCheckout;
  });

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable ||
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.hasAttribute("contenteditable")
      ) {
        return;
      }
      
      if (e.key === "+") {
        e.preventDefault();
        setIsCartOpen(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsDraftModalOpen(false);
        setSelectedProduct(null);
        setIsCartOpen(false);
      } else if (e.key === "Enter" && !isCheckingOut && !processingOrder && isOnline && cart.length > 0) {
        e.preventDefault();
        if (await confirm({ title: "Xác nhận", message: "Xác nhận thanh toán TIỀN MẶT cho đơn hàng?", variant: "warning" })) {
          handleConfirmCheckoutRef.current("Tien mat");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCheckingOut, processingOrder, isOnline, cart.length]);

  return (
    <div className="fixed inset-0 flex bg-page text-text-primary font-sans overflow-hidden">

      {/* Toast Notification Container */}
      <div 
        role="region" 
        aria-live="polite" 
        aria-label="Thông báo"
        className="fixed top-4 right-4 z-[70] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border flex items-start gap-3 transition-colors transform duration-300 animate-slide-in-right ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : toast.type === "warning"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-primary-soft border-blue-200 text-blue-800"
            }`}
          >
            <span className="text-xl shrink-0">
              {toast.type === "success" && "🟢"}
              {toast.type === "error" && "🔴"}
              {toast.type === "warning" && "⚠️"}
              {toast.type === "info" && "ℹ️"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{toast.message}</p>
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action.onClick();
                    removeToast(toast.id);
                  }}
                  className={`mt-2 font-extrabold text-xs px-4 py-2 bg-surface-card rounded-lg border shadow-sm transition active:scale-95 flex items-center justify-center min-h-[44px] min-w-[80px] ${
                    toast.type === "error"
                      ? "text-rose-700 border-rose-200 hover:bg-rose-100"
                      : "text-primary border-indigo-200 hover:bg-primary-soft"
                  }`}
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-muted hover:text-text-secondary shrink-0 p-2 rounded-full hover:bg-black/5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-14 bg-surface-card/80 border-b border-border/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-text-muted hover:text-primary transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <h1 className="font-extrabold text-xl text-text-primary tracking-tight flex items-center gap-2">
              <span className="text-primary">POS</span> Đơn Mới
            </h1>
            {isOnline ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50 shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Trực tuyến
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/50 shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                Ngoại tuyến
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                refreshDrafts();
                setIsDraftModalOpen(true);
              }}
              className="text-sm font-bold text-primary bg-primary-soft px-3 py-1.5 rounded-full hover:bg-primary-soft transition flex items-center gap-1.5"
            >
              📝 Nháp <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">{drafts.length}</span>
            </button>
            <div className="text-sm font-medium text-text-secondary bg-surface-secondary px-3 py-1.5 rounded-full">
              {new Date().toLocaleDateString("vi-VN")}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-amber-500 text-white font-extrabold text-center py-2.5 px-4 text-sm flex items-center justify-center gap-2 animate-fade-in shadow-md shrink-0 relative z-20">
            <span>⚠️ Mất kết nối — đơn sẽ không gửi được</span>
          </div>
        )}

        <ProductGrid
          categories={categories}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredProducts={filteredProducts}
          variants={variants}
          outOfStockProductIds={outOfStockProductIds}
          promoProductsMap={promoProductsMap}
          onProductClick={(p) => openProductModal(p)}
        />
      </div>

      <CartPanel
        cart={cart}
        products={products}
        isCartOpen={isCartOpen}
        setIsCartOpen={setIsCartOpen}
        saveDraft={saveDraft}
        drafts={drafts}
        setCart={setCart}
        setActiveDraftId={setActiveDraftId}
        activeDraftId={activeDraftId}
        openProductModal={openProductModal}
        removeFromCart={removeFromCart}
        changeQty={changeQty}
        promoCodeInput={promoCodeInput}
        setPromoCodeInput={setPromoCodeInput}
        handleApplyPromoCode={handleApplyPromoCode}
        handleRemovePromoCode={handleRemovePromoCode}
        appliedPromo={appliedPromo}
        promoDiscountAmount={promoDiscountAmount}
        manualPromoError={manualPromoError}
        userCustomDiscountType={userCustomDiscountType}
        setUserCustomDiscountType={setUserCustomDiscountType}
        userCustomDiscount={userCustomDiscount}
        setUserCustomDiscount={setUserCustomDiscount}
        handleConfirmCheckout={handleConfirmCheckout}
        isCheckingOut={isCheckingOut}
        itemPromoDiscounts={itemPromoDiscounts}
        isOnline={isOnline}
        processingOrder={processingOrder}
        lastCheckoutError={lastCheckoutError}
        clearLastCheckoutError={() => setLastCheckoutError(null)}
      />

      {/* Mobile Floating Cart Button */}
      {!isCartOpen && cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 font-bold active:scale-95 transition-transform z-30"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">{totalItems}</span>
          </div>
          <span>{formatNumber(totalAmount)}</span>
        </button>
      )}

      {/* Product Selection Modal (Popup Chọn Món) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card/95 backdrop-blur-2xl border border-border/40 w-full sm:w-[500px] max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in">
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-page/50">
              <h3 className="text-xl font-bold text-text-primary">{selectedProduct.name}</h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1.5 bg-border rounded-full text-text-secondary hover:bg-gray-300">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-surface-card">
              {/* SIZE SELECTION */}
              <div>
                <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">Chọn Kích Cỡ</h4>
                <div className="grid grid-cols-2 gap-3">
                  {variants.filter((v: any) => v.product_id === selectedProduct.id).map((v: any) => {
                    const hasPromo = promoVariantsMap.has(v.id);
                    const promoPrice = promoVariantsMap.get(v.id);
                    
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-colors ${selectedVariant?.id === v.id ? "border-orange-500 bg-orange-50" : "border-border bg-surface-card hover:border-orange-200"}`}
                      >
                        <span className={`font-bold text-sm ${selectedVariant?.id === v.id ? "text-orange-700" : "text-text-primary"}`}>{v.size_name}</span>
                        {hasPromo ? (
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-text-muted line-through">{formatNumber(v.price)}</span>
                            <span className="text-sm font-black text-orange-600">{formatNumber(promoPrice)}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-black text-text-primary">{formatNumber(v.price)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MODIFIERS (TOPPINGS, SUGAR, ICE) */}
              {Object.keys(groupedModifiers).map(groupName => (
                <div key={groupName}>
                  <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">{groupName}</h4>
                  <div className="flex flex-col gap-2">
                    {groupedModifiers[groupName].map((mod: any) => {
                      const count = selectedModifiers.filter(m => m.id === mod.id).length;
                      return (
                        <div key={mod.id} className={`flex justify-between items-center px-4 py-3 rounded-xl border transition-colors ${count > 0 ? "border-primary bg-primary-soft shadow-sm" : "border-border bg-surface-card hover:bg-page"}`}>
                          <div className="flex flex-col">
                            <span className={`text-sm ${count > 0 ? "text-primary font-bold" : "text-text-primary font-medium"}`}>{mod.name}</span>
                            {Number(mod.price) > 0 && (
                              <span className="text-xs text-text-secondary mt-0.5">+{formatNumber(mod.price)}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => removeModifier(mod)}
                              disabled={count === 0}
                              className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${count > 0 ? "bg-surface-card text-primary border border-indigo-200 hover:bg-primary-soft shadow-sm" : "bg-surface-secondary text-gray-300 cursor-not-allowed"}`}
                            >
                              -
                            </button>
                            <span className={`font-bold w-4 text-center ${count > 0 ? "text-indigo-800" : "text-text-secondary"}`}>
                              {count}
                            </span>
                            <button
                              onClick={() => addModifier(mod)}
                              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-card text-primary border border-indigo-200 hover:bg-primary-soft font-bold text-lg transition-colors shadow-sm"
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

            <div className="p-4 border-t border-border/50 bg-surface-card/95 backdrop-blur-md shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">

              {/* CHIẾT KHẤU MÓN (Dời xuống footer) */}
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-sm text-text-primary whitespace-nowrap">Chiết khấu:</span>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex rounded-lg overflow-hidden border border-border shrink-0 h-10">
                    <button
                      onClick={() => setItemDiscountType("VND")}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-page text-text-secondary hover:bg-surface-secondary"}`}
                    >
                      VNĐ
                    </button>
                    <button
                      onClick={() => setItemDiscountType("PERCENT")}
                      className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-page text-text-secondary hover:bg-surface-secondary"}`}
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
                    className="flex-1 w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none h-10 text-right"
                  />
                </div>
              </div>

              {/* TỔNG TIỀN & NÚT CẬP NHẬT */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-surface-secondary rounded-xl p-1.5 shrink-0 h-14">
                  <button
                    onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))}
                    className="w-10 h-10 flex items-center justify-center bg-surface-card rounded-lg shadow-sm text-text-secondary font-bold text-xl hover:text-orange-600 transition-colors"
                  >
                    -
                  </button>
                  <span className="text-lg font-black w-6 text-center text-text-primary">{selectedQty}</span>
                  <button
                    onClick={() => setSelectedQty(selectedQty + 1)}
                    className="w-10 h-10 flex items-center justify-center bg-surface-card rounded-lg shadow-sm text-text-secondary font-bold text-xl hover:text-orange-600 transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={addToCart}
                  className="flex-1 bg-orange-600 text-white py-2 px-3 rounded-xl hover:bg-orange-700 active:scale-[0.98] transition-colors transition-transform flex flex-col items-center justify-center h-14"
                >
                  <div className="font-bold text-sm lg:text-base flex flex-col items-center">
                    <span>{editingCartIndex !== null ? "CẬP NHẬT" : "THÊM"} - {formatNumber(currentItemFinalTotal)}</span>
                  </div>
                  {(currentItemManualDiscountAmount > 0 || currentItemPromoDiscountAmount > 0) && (
                    <div className="text-[10px] lg:text-xs text-orange-200 line-through font-medium mt-0.5">
                      Gốc: {formatNumber(currentItemBaseTotal)}
                    </div>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}



      {/* Success Modal */}
      {successOrderNo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card/95 backdrop-blur-2xl border border-border/40 w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
                &#10003;
              </div>
              <h3 className="text-xl font-bold text-text-primary mb-2">Thanh toan thanh cong!</h3>
              <p className="text-sm text-text-secondary mb-3">Ma don hang</p>
              <div className="bg-page border-2 border-dashed border-border rounded-xl p-4 mb-4">
                <span className="text-3xl font-black text-orange-600 tracking-wider">{successOrderNo}</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setSuccessOrderNo(null)}
                className="w-full bg-primary text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-primary-hover active:scale-[0.98] transition-colors transition-transform"
              >
                Tao don moi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Modal */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-card/95 backdrop-blur-2xl border border-border/40 w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-5 border-b border-border/50 flex justify-between items-center bg-page/50">
              <h3 className="text-xl font-bold text-text-primary">Danh sách đơn nháp</h3>
              <button
                onClick={() => setIsDraftModalOpen(false)}
                className="p-1.5 bg-border rounded-full text-text-secondary hover:bg-gray-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 bg-surface-card space-y-4 max-h-[60vh] overflow-y-auto">
              {drafts.length === 0 ? (
                <div className="text-center py-8 text-text-secondary font-medium">
                  Chưa có đơn nháp nào.
                </div>
              ) : (
                <div className="space-y-3">
                  {drafts.map((d: any) => {
                    const totalAmt = d.cart.reduce((sum: number, item: any) => {
                      const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price), 0);
                      const baseTotal = (item.unit_price + modsPrice) * item.qty;
                      let discount = 0;
                      if (item.discount_amount > 0) {
                        if (item.discount_type === "PERCENT") {
                          discount = (baseTotal * item.discount_amount) / 100;
                        } else {
                          discount = item.discount_amount;
                        }
                      }
                      return sum + Math.max(0, baseTotal - discount);
                    }, 0);

                    const totalItems = d.cart.reduce((sum: number, item: any) => sum + item.qty, 0);

                    return (
                      <div key={d.id} className="p-3 bg-page border border-border rounded-xl flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-text-primary truncate">{d.name || "Đơn nháp"}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {totalItems} món • {formatNumber(totalAmt)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                          <button
                            onClick={() => loadDraft(d.id)}
                            className="bg-primary hover:bg-primary-hover text-white font-bold text-xs px-3 py-1.5 rounded-lg transition active:scale-95"
                          >
                            Nạp
                          </button>
                          <button
                            onClick={() => deleteDraft(d.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs px-3 py-1.5 rounded-lg transition active:scale-95"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
