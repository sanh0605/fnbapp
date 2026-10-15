"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { formatNumber } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";
import { submitOrderV2, getPOSDrafts, savePOSDraft, deletePOSDraft } from "@/app/pos/actions";
import type { CartInput } from "@/lib/sales/order-cart";
import {
  priceCart,
  toPricePromotion,
  bestPromotion,
  type PriceCartItem,
  type PriceCartCatalog,
} from "@/lib/sales/price-cart";
import Link from "next/link";
import { ProductGrid } from "./ProductGrid";
import { CartPanel } from "./CartPanel";
import { ItemConfigModal, type ItemConfigSubmission } from "./ItemConfigModal";
import { DraftsModal } from "./DraftsModal";
import { alert, confirm } from "@/lib/shared/dialog";
import {
  resolvePosCheckoutAttempt,
  type PosCheckoutAttempt,
} from "@/lib/pos/pos-checkout-idempotency";
import {
  enqueuePendingOrder,
  incrementAttemptCount,
  listPendingOrders,
  removePendingOrder,
} from "@/lib/pos/pos-offline-queue";
import { reportPosSyncFailure } from "@/app/pos/actions";
import {
  optionGroupsForProduct,
  type OptionGroup,
  type GroupLink,
} from "@/lib/sales/option-groups";

function parseApplicableVariants(applicableData: any): {
  variantsList: string[];
  variantsMap: Record<string, number>;
  isMap: boolean;
} {
  let variantsList: string[] = [];
  let variantsMap: Record<string, number> = {};
  let isMap = false;

  if (!applicableData) {
    return { variantsList, variantsMap, isMap };
  }

  let parsed = applicableData;
  if (typeof applicableData === "string") {
    try {
      parsed = JSON.parse(applicableData);
    } catch {
      return { variantsList, variantsMap, isMap };
    }
  }

  if (Array.isArray(parsed)) {
    variantsList = parsed.map(String);
  } else if (parsed && typeof parsed === "object") {
    variantsMap = parsed;
    variantsList = Object.keys(parsed);
    isMap = true;
  }

  return { variantsList, variantsMap, isMap };
}

export default function POSScreen({
  brandId,
  outletId,
  categories,
  products,
  variants,
  modifiers,
  optionGroups = [],
  optionGroupLinks = [],
  promotions = [],
  bestSellers = [],
  outOfStockProductIds = []
}: {
  brandId?: string;
  outletId?: string;
  categories: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  optionGroups?: OptionGroup[];
  optionGroupLinks?: GroupLink[];
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
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const checkoutAttemptRef = useRef<PosCheckoutAttempt | null>(null);
  // Captured once per logical checkout attempt (i.e. once per distinct cart)
  // and reused unchanged across retries of that same attempt -- otherwise a
  // fresh timestamp on every retry would change the fingerprint fed into
  // resolvePosCheckoutAttempt below and defeat its token-reuse guarantee.
  const clientCapturedAtRef = useRef<string | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const isSyncingRef = useRef<boolean>(false);

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
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/pos-sw.js").catch(() => {
        // Registration failure (unsupported browser, etc.) is not fatal --
        // POS keeps working online exactly as it does today, it just won't
        // have an offline-cached fallback.
      });
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

  // section 3: a
  // draft belongs to the till it was started at, not whatever brand
  // happened to be stamped at that moment.
  const refreshDrafts = async () => {
    if (!outletId) return;
    try {
      const data = await getPOSDrafts(outletId);
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
  }, [outletId]);

  const saveDraft = async (
    cartToSave: any[],
    clearCartAfter: boolean = false,
    silent: boolean = false
  ): Promise<boolean> => {
    if (cartToSave.length === 0) return false;
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

    try {
      const res = await savePOSDraft({
        id: activeDraftId || undefined,
        name: draftName,
        cart_json: JSON.stringify(cartToSave),
        brand_id: brandId || "",
        outlet_id: outletId || "",
      });
      if (res?.success && res.draft) {
        await refreshDrafts();
        if (clearCartAfter) {
          setCart([]);
          setActiveDraftId(null);
        } else {
          setActiveDraftId(res.draft.id);
        }
        return true;
      } else {
        if (!silent) {
          await alert({ title: "Lỗi", message: "Lỗi lưu đơn nháp: " + (res as any)?.error, variant: "danger" });
        }
        return false;
      }
    } catch (err: any) {
      if (!silent) {
        await alert({ title: "Lỗi", message: "Lỗi lưu đơn nháp: " + (err?.message || String(err)), variant: "danger" });
      }
      return false;
    }
  };

  const loadDraft = async (draftId: string) => {
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) return;
    
    if (cart.length > 0) {
      if (await confirm({ title: "Xác nhận", message: "Bạn đang có món trong giỏ. Lưu giỏ hiện tại thành nháp mới trước khi mở nháp này?", variant: "warning" })) {
        const saved = await saveDraft(cart, false, true);
        if (!saved) {
          addToast("error", "Không lưu được giỏ hiện tại, chưa mở đơn nháp");
          return;
        }
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

  // Promotions State
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [manualPromoError, setManualPromoError] = useState<string | null>(null);

  // Cashier Custom Override State
  const [userCustomDiscount, setUserCustomDiscount] = useState<number | null>(null);
  const [userCustomDiscountType, setUserCustomDiscountType] = useState<"VND" | "PERCENT">("VND");

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

  const { promoProductsMap, promoVariantsMap } = useMemo(() => {
    const prodMap = new Map<string, number>();
    const varMap = new Map<string, number>();
    
    const now = new Date();
    (promotions || []).forEach((p: any) => {
      if (p.status !== "ACTIVE" || p.type !== "PRODUCT_DISCOUNT") return;
      const isDateValid = new Date(p.start_date) <= now && (!p.end_date || new Date(p.end_date) >= now);
      if (!isDateValid) return;
      if (p.brand_id && p.brand_id !== brandId) return;

      const {
        variantsList: applicableVariantsList,
        variantsMap: applicableVariantsMap,
        isMap,
      } = parseApplicableVariants(p.applicable_products_json);
      
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
          }
        }
      });
    });
    return { promoProductsMap: prodMap, promoVariantsMap: varMap };
  }, [promotions, variants, brandId]);

  const openProductModal = async (product: any, editIndex: number | null = null) => {
    const prodVariants = variants.filter((v: any) => v.product_id === product.id);
    if (prodVariants.length === 0) return await alert({ message: "Món này chưa cấu hình size & giá." });

    setSelectedProduct(product);
    setEditingCartIndex(editIndex);
  };

  // Assembles the cart line from the child's submitted configuration. The
  // child owns the item-config state (variant, modifiers, qty, discount) and
  // emits it on submit; only the parent knows the cart-line id rule and the
  // cart array itself.
  const handleItemConfigSubmit = (config: ItemConfigSubmission) => {
    const cartItem = {
      id: editingCartIndex !== null ? cart[editingCartIndex].id : Date.now().toString(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      variant_id: config.variant.id,
      size_name: config.variant.size_name,
      unit_price: Number(config.variant.price),
      modifiers: config.modifiers,
      qty: config.qty,
      discount_amount: config.discountAmount,
      discount_type: config.discountType
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

  const eligiblePromotions = useMemo(() => {
    const now = new Date();
    return (promotions || []).filter((p: any) => {
      if (p.status !== "ACTIVE") return false;
      const isDateValid = new Date(p.start_date) <= now && (!p.end_date || new Date(p.end_date) >= now);
      if (!isDateValid) return false;

      const isBrandValid = !p.brand_id || p.brand_id === brandId;
      if (!isBrandValid) return false;

      return true;
    });
  }, [promotions, brandId, cart]);

  const { appliedPromo, promoDiscountAmount, itemPromoDiscounts, orderManualAmount, totalAmount } = useMemo(() => {
    if (cart.length === 0) {
      return {
        appliedPromo: null,
        promoDiscountAmount: 0,
        itemPromoDiscounts: [],
        orderManualAmount: 0,
        totalAmount: 0,
      };
    }

    const cartItems: PriceCartItem[] = cart.map((item) => ({
      variant_id: item.variant_id,
      qty: item.qty,
      modifiers: item.modifiers.map((m: any) => ({
        modifier_id: m.id,
        modifier_qty: 1,
      })),
      manual_item_discount: {
        value: Number(item.discount_amount || 0),
        type: item.discount_type === "PERCENT" ? "PERCENT" : "VND",
      },
    }));

    const catalog: PriceCartCatalog = {
      variants: cart.map((item) => ({ id: item.variant_id, price: Number(item.unit_price) })),
      modifiers: cart.flatMap((item) =>
        item.modifiers.map((m: any) => ({ id: m.id, price: Number(m.price) }))
      ),
    };

    const appliedPromo = bestPromotion(eligiblePromotions, cartItems, catalog, appliedPromoCode);

    const manualOrderDiscount = userCustomDiscount !== null
      ? { value: userCustomDiscount, type: userCustomDiscountType }
      : null;

    const result = priceCart(
      cartItems,
      catalog,
      appliedPromo ? [toPricePromotion(appliedPromo)] : [],
      manualOrderDiscount
    );

    const promoDiscountAmount = result.applied.reduce((sum, a) => sum + a.amount, 0);
    const itemPromoDiscounts = result.lines.map((l) => l.promo + l.orderPromo);
    const orderManualAmount = result.lines.reduce((s, l) => s + l.orderManual, 0);

    return {
      appliedPromo,
      promoDiscountAmount,
      itemPromoDiscounts,
      orderManualAmount,
      totalAmount: result.total,
    };
  }, [cart, eligiblePromotions, appliedPromoCode, userCustomDiscount, userCustomDiscountType]);

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
      const { variantsList: applicableVariants } = parseApplicableVariants(
        matchedPromo.applicable_products_json
      );

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





  const syncPendingOrders = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const pending = await listPendingOrders();
      setPendingCount(pending.length);
      for (const record of pending) {
        try {
          const res = await submitOrderV2(record.cartInput, record.requestToken);
          if (res.success) {
            await removePendingOrder(record.requestToken);
          } else {
            // A real rejection, not a network failure -- retrying it forever
            // would never succeed. No one is watching this device's screen
            // for this specific order anymore, so surface it to the admin
            // dashboard instead of the staff UI.
            const report = await reportPosSyncFailure(record.requestToken, record.cartInput, res.error);
            if (report.success) {
              await removePendingOrder(record.requestToken);
            } else {
              // Reporting the failure itself failed (e.g. the pos_sync_failures
              // table doesn't exist yet before migration 0040 is applied).
              // Leave the order queued -- deleting it here with nowhere the
              // failure was actually recorded would lose the sale silently.
              await incrementAttemptCount(record.requestToken);
            }
          }
        } catch {
          // Still no network (or it dropped again mid-retry). Leave it
          // queued; the next online event or page mount will try again.
          await incrementAttemptCount(record.requestToken);
        }
      }
    } catch {
      // listPendingOrders() itself failed (IndexedDB error, etc.)
      // Self-heals on next mount or online event
    } finally {
      isSyncingRef.current = false;
      try {
        const remaining = await listPendingOrders();
        setPendingCount(remaining.length);
      } catch {}
    }
  };

  useEffect(() => {
    syncPendingOrders();
  }, []);

  useEffect(() => {
    window.addEventListener("online", syncPendingOrders);
    return () => {
      window.removeEventListener("online", syncPendingOrders);
    };
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      syncPendingOrders();
    }, 60000);
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleConfirmCheckout = async (method: string, payments?: any[]) => {
    if (cart.length === 0) return;
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
    const currentTotalAmount = totalAmount;
    const currentTotalItems = totalItems;

    // Fingerprinted without client_captured_at: that field is decided below,
    // once per logical attempt, so it must never influence whether a retry
    // is recognized as "the same attempt" by resolvePosCheckoutAttempt.
    const cartInputWithoutTimestamp: CartInput = {
      brand_id: brandId || "",
      outlet_id: outletId || "",
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
      payment_method: method === "Chuyen khoan" ? "BANK_TRANSFER" : (method === "SPLIT" ? "CASH" : "CASH"),
      payments: payments && payments.length > 0 ? payments : undefined,
      manual_order_discount: userCustomDiscount !== null
        ? {
            value: userCustomDiscount,
            type: userCustomDiscountType,
          }
        : null,
      applied_promotion_id: appliedPromo?.id || null,
      promo_code: appliedPromo?.code ? (appliedPromoCode ?? undefined) : undefined,
      actor: { id: "", name: "" },
    };
    const checkoutAttempt = resolvePosCheckoutAttempt(
      checkoutAttemptRef.current,
      cartInputWithoutTimestamp,
    );
    // resolvePosCheckoutAttempt returns the SAME object reference when it
    // decides to reuse the existing attempt, and a new object for a new
    // attempt -- checked before checkoutAttemptRef.current is reassigned.
    const isNewAttempt = checkoutAttempt !== checkoutAttemptRef.current;
    checkoutAttemptRef.current = checkoutAttempt;

    let clientCapturedAt = clientCapturedAtRef.current;
    if (isNewAttempt || clientCapturedAt === null) {
      clientCapturedAt = new Date().toISOString();
      clientCapturedAtRef.current = clientCapturedAt;
    }

    const cartInput: CartInput = {
      ...cartInputWithoutTimestamp,
      client_captured_at: clientCapturedAt,
    };

    // Construct optimistic processing order details
    const newProcessingOrder = {
      items: cartBackup,
      totalAmount: currentTotalAmount,
      totalItems: currentTotalItems,
      subtotal: currentSubtotal,
      paymentMethod: method === "Chuyen khoan" ? "BANK_TRANSFER" : (method === "SPLIT" ? "CASH" : "CASH"),
      methodLabel: method === "Chuyen khoan" ? "CHUYỂN KHOẢN" : (method === "SPLIT" ? "NHIỀU HÌNH THỨC" : "TIỀN MẶT"),
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
      const res = await submitOrderV2(
        cartInput,
        checkoutAttempt.requestToken,
      );
      setIsCheckingOut(null);
      setProcessingOrder(null);

      if (res.success) {
        checkoutAttemptRef.current = null;
        clientCapturedAtRef.current = null;
        addToast("success", "Thanh toán thành công!");
        
        if (draftIdBackup) {
          deletePOSDraft(draftIdBackup).then(delRes => {
            if (delRes.success) {
              refreshDrafts();
            }
          });
        }
        syncPendingOrders();
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
              handleConfirmCheckout(method, payments);
            }
          }
        );
      }
    } catch (err: any) {
      setIsCheckingOut(null);
      setProcessingOrder(null);

      try {
        await enqueuePendingOrder({
          requestToken: checkoutAttempt.requestToken,
          cartInput,
          queuedAt: clientCapturedAt,
          attemptCount: 1,
        });
        checkoutAttemptRef.current = null;
        clientCapturedAtRef.current = null;
        addToast("success", "Đã lưu đơn hàng, sẽ gửi khi có mạng trở lại.");
        if (draftIdBackup) {
          deletePOSDraft(draftIdBackup).then(delRes => {
            if (delRes.success) refreshDrafts();
          });
        }
        try {
          const pending = await listPendingOrders();
          setPendingCount(pending.length);
        } catch {}
      } catch (queueErr) {
        // IndexedDB itself failed (extremely rare -- private browsing mode
        // with storage disabled, or storage quota exceeded). Only now fall
        // back to the old interactive rollback+retry, since there is
        // nowhere left to durably hold the order.
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
              handleConfirmCheckout(method, payments);
            }
          }
        );
      }
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
      } else if (e.key === "Enter" && !isCheckingOut && !processingOrder && cart.length > 0) {
        e.preventDefault();
        if (await confirm({ title: "Xác nhận", message: "Xác nhận thanh toán TIỀN MẶT cho đơn hàng?", variant: "warning" })) {
          handleConfirmCheckoutRef.current("Tien mat");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCheckingOut, processingOrder, cart.length]);

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
                ? "bg-success/10 border-success/20 text-success"
                : toast.type === "error"
                ? "bg-danger/10 border-danger/20 text-danger"
                : toast.type === "warning"
                ? "bg-warning/10 border-warning/20 text-warning"
                : "bg-primary-soft border-primary/20 text-primary"
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
                      ? "text-danger border-danger/20 hover:bg-danger/5"
                      : "text-primary border-primary/20 hover:bg-primary-soft"
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
        <header className="h-14 bg-surface-card/80 border-b border-border/50 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 min-w-0">
            <Link href="/admin" className="text-text-muted hover:text-primary transition-colors shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <h1 className="font-extrabold text-lg sm:text-xl text-text-primary tracking-tight flex items-center gap-1 sm:gap-2 shrink-0">
              <span className="text-primary">POS</span>
              <span className="hidden sm:inline"> Đơn Mới</span>
            </h1>
            {isOnline ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-success/10 text-success border border-success/20 shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                Trực tuyến
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-danger/10 text-danger border border-danger/20 shadow-sm shrink-0">
                <span className="w-2 h-2 rounded-full bg-danger animate-ping"></span>
                Ngoại tuyến
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20 shadow-sm shrink-0 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse"></span>
                {pendingCount} đơn chờ gửi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button 
              onClick={() => {
                refreshDrafts();
                setIsDraftModalOpen(true);
              }}
              className="text-xs sm:text-sm font-bold text-primary bg-primary-soft px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-primary-soft transition flex items-center gap-1.5 shrink-0"
            >
              📝 Nháp <span className="bg-primary text-on-primary text-[10px] px-1.5 py-0.5 rounded-full">{drafts.length}</span>
            </button>
            <div className="hidden sm:block text-sm font-medium text-text-secondary bg-surface-secondary px-3 py-1.5 rounded-full shrink-0">
              {formatDate(new Date())}
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-warning text-white font-extrabold text-center py-2.5 px-4 text-sm flex items-center justify-center gap-2 animate-fade-in shadow-md shrink-0 relative z-20">
            <span>⚠️ Mất kết nối — đơn vẫn được lưu, sẽ tự gửi khi có mạng</span>
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
        orderManualAmount={orderManualAmount}
        totalAmount={totalAmount}
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

      {/* Mobile Floating Cart Button (hidden in favor of collapsed bar) */}
      {!isCartOpen && cart.length > 0 && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="hidden fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 font-bold active:scale-95 transition-transform z-30"
        >
          <div className="relative">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <span className="absolute -top-2 -right-2 bg-warning text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-primary">{totalItems}</span>
          </div>
          <span>{formatNumber(totalAmount)}</span>
        </button>
      )}

      {/* Product Selection Modal (Popup Chọn Món) */}
      {selectedProduct && (
        <ItemConfigModal
          // F2b (regression from F2): the modal has no focus trap (OPEN-ITEMS
          // 40), so the tiles and cart rows behind it can still be reached by
          // keyboard while it is open. Without a key, a second
          // openProductModal call while already mounted only changes props --
          // React reconciles the same component instance in place, so the
          // useState initialisers that seed variant/modifiers/qty/discount
          // from `initialLine` never re-run, and the modal keeps the previous
          // product's configuration under the new product's name. The key
          // forces a remount (fresh useState initialisers) whenever the
          // product or the cart line being edited changes -- exactly what
          // openProductModal's own setters used to do before F2 moved that
          // state into the child.
          key={`${selectedProduct.id}-${editingCartIndex ?? "new"}`}
          product={selectedProduct}
          variants={variants}
          groups={optionGroupsForProduct(selectedProduct.id, optionGroups, optionGroupLinks, modifiers)}
          promoVariantsMap={promoVariantsMap}
          eligiblePromotions={eligiblePromotions}
          appliedPromoCode={appliedPromoCode}
          initialLine={editingCartIndex !== null ? cart[editingCartIndex] : null}
          isEditing={editingCartIndex !== null}
          onSubmit={handleItemConfigSubmit}
          onClose={() => setSelectedProduct(null)}
        />
      )}



      {/* Draft Modal */}
      {isDraftModalOpen && (
        <DraftsModal
          drafts={drafts}
          calculateItemTotal={calculateItemTotal}
          onLoad={loadDraft}
          onDelete={deleteDraft}
          onClose={() => setIsDraftModalOpen(false)}
        />
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
