"use client";

import { useState, useId, useRef, useEffect } from "react";
import { savePurchaseOrder, addPurchaseSource } from "../actions";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { draftKey, saveDraft, takeDraft, type PoDraftState } from "./po-draft";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import type { DBSupplier, DBPurchaseSource, DBPurchasedItem, DBUOMConversion, DBUnit, DBPurchaseOrder, DBPurchaseOrderLine, DBBankAccount } from "@/types/db";
import type { PurchaseOrderCopySeed } from "@/lib/purchasing/purchase-order-copy";
import { alert } from "@/lib/shared/dialog";
import { PurchaseOrderLines } from "./PurchaseOrderLines";
import { PurchaseOrderTotals } from "./PurchaseOrderTotals";

export function validatePurchaseOrderLine(
  line: { purchased_item_id?: string; unit?: string; conversion_id?: string; quantity?: string | number },
  conversions: Array<{ purchased_item_id?: string; status?: string }>,
): string | null {
  if (!line.purchased_item_id) return "Vui lòng chọn hàng hoá";
  if (!line.unit) return "Vui lòng nhập hoặc chọn đơn vị";
  if (!(Number(line.quantity) > 0)) return "Vui lòng nhập số lượng";
  const available = conversions.filter(
    c => c.purchased_item_id === line.purchased_item_id && c.status !== "INACTIVE",
  );
  if (available.length > 0 && !line.conversion_id) return "Vui lòng chọn đơn vị";
  return null;
}

export function validatePurchaseOrderHeader(input: {
  supplierId: string;
  sourceId: string;
  lineCount: number;
}): string | null {
  if (!input.supplierId) return "Vui lòng chọn nhà cung cấp";
  if (!input.sourceId) return "Vui lòng chọn nguồn nhập hàng";
  if (input.lineCount === 0) return "Vui lòng thêm ít nhất 1 mặt hàng";
  return null;
}

function formatLinesWithConversions(rawLines: any[], conversions: DBUOMConversion[]) {
  return rawLines.map((line: any) => {
    let matchedConv = conversions.find(
      (c: any) => c.id === line.conversion_id && c.purchased_item_id === line.purchased_item_id
    );
    if (!matchedConv && line.purchased_item_id && line.unit) {
      const candidates = conversions.filter(
        (c: any) =>
          c.purchased_item_id === line.purchased_item_id &&
          String(c.purchased_unit).trim() === String(line.unit).trim()
      );
      matchedConv = candidates.length === 1 ? candidates[0] : undefined;
    }

    return {
      purchased_item_id: line.purchased_item_id || "",
      unit: line.unit || "",
      quantity: Number(line.quantity) > 0 ? String(line.quantity) : "",
      subtotal: line.subtotal || 0,
      is_new_unit: false,
      conversion_id: matchedConv?.id || "",
      conversion_rate: matchedConv?.conversion_rate || "",
    };
  });
}

interface PurchaseOrderFormProps {
  suppliers: DBSupplier[];
  sources: DBPurchaseSource[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  bankAccounts?: DBBankAccount[];
  initialData?: {
    po: DBPurchaseOrder;
    lines: DBPurchaseOrderLine[];
  };
  copySeed?: PurchaseOrderCopySeed;
}

export default function PurchaseOrderForm({
  suppliers,
  sources = [],
  items,
  conversions,
  units = [],
  bankAccounts = [],
  initialData,
  copySeed,
}: PurchaseOrderFormProps) {
  const formId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);
  const isEdit = !!initialData?.po;
  const po = initialData?.po || ({} as Partial<DBPurchaseOrder>);
  const initialLines = initialData?.lines;

  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState(initialData?.po?.supplier_id || copySeed?.supplier_id || "");
  const [sourceId, setSourceId] = useState(initialData?.po?.source_id || copySeed?.source_id || "");
  const [supplierInvoiceCode, setSupplierInvoiceCode] = useState(
    initialData?.po?.supplier_invoice_code || copySeed?.supplier_invoice_code || ""
  );
  const [transactionDate, setTransactionDate] = useState<Date | null>(
    initialData?.po?.transaction_date
      ? new Date(initialData.po.transaction_date)
      : copySeed?.transaction_date
      ? new Date(copySeed.transaction_date)
      : null
  );
  const [notes, setNotes] = useState(initialData?.po?.notes || copySeed?.notes || "");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER" | "">(
    (initialData?.po?.payment_method as any) || (copySeed?.payment_method as any) || ""
  );
  const [bankAccountId, setBankAccountId] = useState(
    initialData?.po?.bank_account_id || copySeed?.bank_account_id || ""
  );
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const rawLines = initialLines ?? (copySeed ? copySeed.lines : []);
  const [lines, setLines] = useState<any[]>(formatLinesWithConversions(rawLines, conversions));

  const [shippingFee, setShippingFee] = useState(Number(initialData?.po?.shipping_fee || copySeed?.shipping_fee || 0));
  const [taxAmount, setTaxAmount] = useState(Number(initialData?.po?.tax_amount || copySeed?.tax_amount || 0));
  const [voucherAmount, setVoucherAmount] = useState(Number(initialData?.po?.voucher_amount || copySeed?.voucher_amount || 0));
  const [discountAmount, setDiscountAmount] = useState(Number(initialData?.po?.discount_amount || copySeed?.discount_amount || 0));

  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const isDraftParam = searchParams?.get("draft") === "1";
    if (!isDraftParam) return;

    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const key = draftKey(po.id);
    const draft = takeDraft(storage, key, Date.now());

    const newSupplierParam = searchParams?.get("newSupplier");
    const isValidSupplier = !!newSupplierParam && suppliers.some((s: any) => s.id === newSupplierParam);

    if (draft) {
      if (draft.supplierId !== undefined) setSupplierId(draft.supplierId);
      if (draft.sourceId !== undefined) setSourceId(draft.sourceId);
      if (draft.supplierInvoiceCode !== undefined) setSupplierInvoiceCode(draft.supplierInvoiceCode);
      setTransactionDate(draft.transactionDate ? new Date(draft.transactionDate) : null);
      if (draft.notes !== undefined) setNotes(draft.notes);
      if (Array.isArray(draft.lines)) setLines(draft.lines);
      if (draft.shippingFee !== undefined) setShippingFee(Number(draft.shippingFee));
      if (draft.taxAmount !== undefined) setTaxAmount(Number(draft.taxAmount));
      if (draft.voucherAmount !== undefined) setVoucherAmount(Number(draft.voucherAmount));
      if (draft.discountAmount !== undefined) setDiscountAmount(Number(draft.discountAmount));
      if (draft.paymentMethod !== undefined) {
        setPaymentMethod(
          draft.paymentMethod === "CASH" || draft.paymentMethod === "BANK_TRANSFER"
            ? draft.paymentMethod
            : ""
        );
      }
      if (draft.bankAccountId !== undefined) setBankAccountId(draft.bankAccountId || "");
    } else {
      setRestoreFailed(true);
    }

    if (isValidSupplier) {
      setSupplierId(newSupplierParam!);
    }

    const nextParams = new URLSearchParams(searchParams ? searchParams.toString() : "");
    nextParams.delete("draft");
    nextParams.delete("newSupplier");
    const nextQuery = nextParams.toString();
    const currentPath = pathname || (isEdit && po.id ? `/admin/inventory/purchase-orders/${po.id}` : "/admin/inventory/purchase-orders/new");
    router.replace(nextQuery ? `${currentPath}?${nextQuery}` : currentPath);
  }, []);

  const addLine = () => {
    setLines([...lines, {
      purchased_item_id: "",
      unit: "",
      quantity: "",
      subtotal: 0,
      is_new_unit: false,
      conversion_rate: "",
    }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index][field] = value;

    if (field === "purchased_item_id") {
      newLines[index].unit = "";
      newLines[index].is_new_unit = false;
      newLines[index].conversion_id = "";
      newLines[index].conversion_rate = "";
    }

    if (field === "conversion_id") {
      const conv = conversions.find((c: any) => c.id === value);
      newLines[index].unit = conv ? conv.purchased_unit : "";
      newLines[index].conversion_rate = conv ? conv.conversion_rate : "";
      newLines[index].conversion_id = conv ? value : "";
    }

    setLines(newLines);
  };

  const subtotalAmount = lines.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const totalAmount = subtotalAmount + Number(shippingFee) + Number(taxAmount) - Number(voucherAmount) - Number(discountAmount);

  const handleSubmit = async (status: string) => {
    if (status === "COMPLETED") {
      const headerError = validatePurchaseOrderHeader({ supplierId, sourceId, lineCount: lines.length });
      if (headerError) return await alert({ title: "Thiếu thông tin", message: headerError, variant: "warning" });

      for (let i = 0; i < lines.length; i++) {
        const lineError = validatePurchaseOrderLine(lines[i], conversions);
        if (lineError) return await alert({ title: "Thiếu thông tin", message: `Dòng ${i + 1}: ${lineError}`, variant: "warning" });
      }
    }

    setLoading(true);
    setPaymentError(null);
    const formData = new FormData();
    if (isEdit) formData.append("id", po.id!);
    formData.append("supplier_id", supplierId);
    if (transactionDate) formData.append("transaction_date", toSaigonIsoString(transactionDate));
    formData.append("notes", notes);
    formData.append("source_id", sourceId);
    formData.append("supplier_invoice_code", supplierInvoiceCode);
    formData.append("status", status);
    formData.append("lines_json", JSON.stringify(lines));
    formData.append("subtotal_amount", String(subtotalAmount));
    formData.append("shipping_fee", String(shippingFee));
    formData.append("tax_amount", String(taxAmount));
    formData.append("voucher_amount", String(voucherAmount));
    formData.append("discount_amount", String(discountAmount));
    formData.append("payment_method", paymentMethod);
    formData.append("bank_account_id", paymentMethod === "BANK_TRANSFER" ? bankAccountId : "");

    const res = await savePurchaseOrder(formData);
    setLoading(false);

    if (res.success) {
      const assetWarning = (res as { assetWarning?: string }).assetWarning;
      const poId = (res as { po_id?: string }).po_id;
      if (assetWarning) {
        router.push(`/admin/inventory/purchase-orders/${poId}?assetWarning=1`);
      } else {
        router.push("/admin/inventory/purchase-orders");
      }
      router.refresh();
    } else {
      if (
        res.error === "Chọn cách trả tiền" ||
        res.error === "Chọn tài khoản nhận chuyển khoản" ||
        res.error === "Tài khoản không còn dùng"
      ) {
        setPaymentError(res.error);
      } else {
        await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
      }
    }
  };

  return (
    <>
      {restoreFailed && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl border border-warning/40 bg-warning/10 text-warning-active text-sm font-medium"
        >
          Không khôi phục được phiếu đang nhập dở
        </div>
      )}
      <div
        data-testid="form-layout"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start lg:grid-rows-[auto_1fr]"
      >
        <div
          data-testid="form-shared"
          className="bg-surface-card rounded-xl shadow-sm border border-border p-6 lg:col-start-3 lg:row-start-1 space-y-4"
        >
          <div>
            <Field label="Nhà cung cấp" htmlFor={`${formId}-supplierId`} required>
              <SearchableSelect
                id={`${formId}-supplierId`}
                value={supplierId}
                onChange={(val) => setSupplierId(val)}
                options={suppliers.map((s: any) => ({ id: s.id, label: s.name }))}
                placeholder="Chọn nhà cung cấp..."
                onCreateNew={(searchTerm) => {
                  const currentParams = new URLSearchParams(searchParams ? searchParams.toString() : "");
                  currentParams.delete("newSupplier");
                  currentParams.set("draft", "1");
                  const currentPath = pathname || (isEdit && po.id ? `/admin/inventory/purchase-orders/${po.id}` : "/admin/inventory/purchase-orders/new");
                  const returnTo = `${currentPath}?${currentParams.toString()}`;

                  const storage = typeof window !== "undefined" ? window.localStorage : null;
                  const draftState: PoDraftState = {
                    supplierId,
                    sourceId,
                    supplierInvoiceCode,
                    transactionDate: transactionDate ? transactionDate.toISOString() : null,
                    notes,
                    lines,
                    shippingFee,
                    taxAmount,
                    voucherAmount,
                    discountAmount,
                    paymentMethod: paymentMethod || null,
                    bankAccountId: bankAccountId || null,
                  };
                  saveDraft(storage, draftKey(po.id), draftState, Date.now());
                  router.push(`/admin/suppliers/new?from=po&name=${encodeURIComponent(searchTerm)}&returnTo=${encodeURIComponent(returnTo)}`);
                }}
              />
            </Field>
          </div>
          <div>
            <Field
              label="Ngày nhập hàng thực tế"
              htmlFor={`${formId}-transactionDate`}
              hint="Để trống hệ thống sẽ lấy thời điểm hiện tại."
            >
              <CustomDatePicker
                id={`${formId}-transactionDate`}
                name="transaction_date"
                selected={transactionDate}
                onChange={(date) => setTransactionDate(date)}
                placeholderText="Chọn ngày nhập hàng (ngày/tháng/năm)"
              />
            </Field>
          </div>
          <div>
            <Field label="Nguồn nhập hàng" htmlFor={`${formId}-sourceId`}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    id={`${formId}-sourceId`}
                    value={sourceId}
                    onChange={(val) => setSourceId(val)}
                    options={sources.map((s: any) => ({ id: s.id, label: s.name }))}
                    placeholder="Ví dụ: Shopee, Lazada..."
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    const name = window.prompt("Nhập tên nguồn mới (VD: Tiktok Shop):");
                    if (name && name.trim()) {
                      const res = await addPurchaseSource(name.trim());
                      if (res.success) {
                        await alert({ title: "Thiếu thông tin", message: "Đã thêm nguồn thành công! Vui lòng tải lại trang để cập nhật danh sách.", variant: "warning" });
                      } else {
                        await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
                      }
                    }
                  }}
                >
                  + Thêm
                </Button>
              </div>
            </Field>
          </div>
          <div>
            <Field label="Mã hoá đơn" htmlFor={`${formId}-supplierInvoiceCode`}>
              <TextInput
                id={`${formId}-supplierInvoiceCode`}
                type="text"
                value={supplierInvoiceCode}
                onChange={(e) => setSupplierInvoiceCode(e.target.value)}
                placeholder="Ví dụ: INV-20231201"
              />
            </Field>
          </div>
          <div>
            <Field label="Ghi chú" htmlFor={`${formId}-notes`}>
              <TextInput
                id={`${formId}-notes`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ví dụ: giao buổi sáng"
              />
            </Field>
          </div>
        </div>

        <div
          data-testid="form-lines"
          className="bg-surface-card rounded-xl shadow-sm border border-border p-6 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2"
        >
          <PurchaseOrderLines
            lines={lines}
            items={items}
            conversions={conversions}
            units={units}
            formId={formId}
            addLine={addLine}
            removeLine={removeLine}
            updateLine={updateLine}
          />
        </div>

        <div
          data-testid="form-money"
          className="lg:col-start-3 lg:row-start-2"
        >
          <PurchaseOrderTotals
            formId={formId}
            subtotalAmount={subtotalAmount}
            totalAmount={totalAmount}
            shippingFee={shippingFee}
            setShippingFee={setShippingFee}
            taxAmount={taxAmount}
            setTaxAmount={setTaxAmount}
            voucherAmount={voucherAmount}
            setVoucherAmount={setVoucherAmount}
            discountAmount={discountAmount}
            setDiscountAmount={setDiscountAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            bankAccountId={bankAccountId}
            setBankAccountId={setBankAccountId}
            bankAccounts={bankAccounts}
            paymentError={paymentError}
            setPaymentError={setPaymentError}
          />

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="primary"
              loading={loading}
              onClick={() => handleSubmit("COMPLETED")}
              className="w-full min-h-[44px]"
            >
              {isEdit ? "Cập nhật & Hoàn thành" : "Tạo"}
            </Button>
            {!(isEdit && po.status === "COMPLETED") && (
              <Button
                type="button"
                variant="secondary"
                loading={loading}
                onClick={() => handleSubmit("DRAFT")}
                className="w-full min-h-[44px]"
              >
                Lưu nháp
              </Button>
            )}
          </div>
        </div>
      </div>

      <datalist id="units-list">
        {units.map((u: any) => (
          <option key={u.id} value={u.name} />
        ))}
      </datalist>
    </>
  );
}
