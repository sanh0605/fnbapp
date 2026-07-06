"use client";

import { useState, useId } from "react";
import { savePurchaseOrder, addPurchaseSource } from "../actions";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/SearchableSelect";
import { SupplierModal } from "@/components/SupplierForm";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { toSaigonIsoString } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import type { DBSupplier, DBPurchaseSource, DBPurchasedItem, DBUOMConversion, DBBaseIngredient, DBUnit, DBPurchaseOrder, DBPurchaseOrderLine } from "@/types/db";

interface PurchaseOrderFormProps {
  suppliers: DBSupplier[];
  sources: DBPurchaseSource[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: {
    po: DBPurchaseOrder;
    lines: DBPurchaseOrderLine[];
  };
}

export default function PurchaseOrderForm({ suppliers, sources = [], items, conversions, baseIngredients, units = [], initialData }: PurchaseOrderFormProps) {
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData?.po;
  const po = initialData?.po || ({} as Partial<DBPurchaseOrder>);
  const initialLines = initialData?.lines || [];

  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState(po.supplier_id || "");
  const [sourceId, setSourceId] = useState(po.source_id || "");
  const [supplierInvoiceCode, setSupplierInvoiceCode] = useState(po.supplier_invoice_code || "");
  const [transactionDate, setTransactionDate] = useState<Date | null>(po.transaction_date ? new Date(po.transaction_date) : null);
  const [notes, setNotes] = useState(po.notes || "");
  
  // Format initial lines to match form state structure
  const formattedInitialLines = initialLines.map((line: any) => {
    // Bước 1: Tìm conversion record
    // Ưu tiên dùng conversion_id đã lưu trong DB (sau khi fix actions.ts)
    // Fallback: tìm theo purchased_item_id + purchased_unit (với dữ liệu cũ chưa có conversion_id)
    let matchedConv = conversions.find(
      (c: any) => c.id === line.conversion_id && c.purchased_item_id === line.purchased_item_id
    );
    if (!matchedConv && line.purchased_item_id && line.unit) {
      const fallbackCandidates = conversions.filter(
        (c: any) =>
          c.purchased_item_id === line.purchased_item_id &&
          String(c.purchased_unit).trim() === String(line.unit).trim()
      );
      matchedConv = fallbackCandidates.length === 1 ? fallbackCandidates[0] : undefined;
    }

    // Bước 2: Restore base_ingredient_id và base_unit từ Purchased_Items
    const selectedItem = items.find((i: any) => i.id === line.purchased_item_id);
    const base_ingredient_id = selectedItem?.base_ingredient_id || "";
    const baseIng = base_ingredient_id
      ? baseIngredients.find((b: any) => b.id === base_ingredient_id)
      : null;
    const base_unit = baseIng?.base_unit || "";

    return {
      purchased_item_id: line.purchased_item_id || "",
      unit: line.unit || "",
      quantity: line.quantity || 1,
      subtotal: line.subtotal || 0,
      is_new_unit: false,
      // Restore từ conversion record
      conversion_id: matchedConv?.id || "",
      conversion_rate: matchedConv?.conversion_rate || "",
      // Restore từ item lookup
      base_ingredient_id,
      base_unit,
    };
  });


  const [lines, setLines] = useState<any[]>(formattedInitialLines.length > 0 ? formattedInitialLines : []);
  
  // Extra costs
  const [shippingFee, setShippingFee] = useState(Number(po.shipping_fee || 0));
  const [taxAmount, setTaxAmount] = useState(Number(po.tax_amount || 0));
  const [voucherAmount, setVoucherAmount] = useState<number>(Number(po?.voucher_amount || 0));
  const [discountAmount, setDiscountAmount] = useState<number>(Number(po?.discount_amount || 0));
  
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const addLine = () => {
    setLines([...lines, {
      purchased_item_id: "",
      unit: "",
      quantity: 1,
      subtotal: 0,
      is_new_unit: false,
      conversion_rate: "",
      base_unit: "",
      base_ingredient_id: ""
    }]);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index][field] = value;

    // Auto-fill logic when item changes
    if (field === "purchased_item_id") {
      const selectedItem = items.find((i: any) => i.id === value);
      newLines[index].base_ingredient_id = selectedItem?.base_ingredient_id || "";
      if (selectedItem?.base_ingredient_id) {
        const baseIng = baseIngredients.find((b: any) => b.id === selectedItem.base_ingredient_id);
        newLines[index].base_unit = baseIng?.base_unit || "";
      } else {
        newLines[index].base_unit = "";
      }
      // Reset unit selection
      newLines[index].unit = "";
      newLines[index].is_new_unit = false;
      newLines[index].conversion_id = "";
      newLines[index].conversion_rate = "";
    }

    if (field === "conversion_id") {
      const conv = conversions.find((c: any) => c.id === value);
      if (conv) {
        newLines[index].unit = conv.purchased_unit;
        newLines[index].conversion_rate = conv.conversion_rate;
        newLines[index].conversion_id = value;
      } else {
        newLines[index].unit = "";
        newLines[index].conversion_rate = "";
        newLines[index].conversion_id = "";
      }
    }

    setLines(newLines);
  };

  const subtotalAmount = lines.reduce((sum, line) => sum + Number(line.subtotal), 0);
  const totalAmount = subtotalAmount + Number(shippingFee) + Number(taxAmount) - Number(voucherAmount) - Number(discountAmount);

  const handleSubmit = async (status: string) => {
    if (status === "COMPLETED") {
      if (!supplierId) return alert("Vui lòng chọn nhà cung cấp");
      if (lines.length === 0) return alert("Vui lòng thêm ít nhất 1 mặt hàng");

      // Validation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.purchased_item_id) return alert(`Dòng ${i + 1}: Vui lòng chọn hàng hoá`);
        if (!line.unit) return alert(`Dòng ${i + 1}: Vui lòng nhập hoặc chọn đơn vị`);
        if (!line.conversion_id) return alert(`Dòng ${i + 1}: Vui lòng chọn đơn vị`);
      }
    }

    setLoading(true);
    const formData = new FormData();
    if (isEdit) formData.append("id", po.id!);
    formData.append("supplier_id", supplierId);
    // Claude code — UI-9: send Saigon-local ISO so server interprets date correctly regardless of deploy TZ.
    if (transactionDate) formData.append("transaction_date", toSaigonIsoString(transactionDate));
    formData.append("notes", notes);
    formData.append("source_id", sourceId);
    formData.append("supplier_invoice_code", supplierInvoiceCode);
    formData.append("status", status);
    formData.append("lines_json", JSON.stringify(lines));
    formData.append("subtotal_amount", subtotalAmount.toString());
    formData.append("shipping_fee", shippingFee.toString());
    formData.append("tax_amount", taxAmount.toString());
    formData.append("voucher_amount", voucherAmount.toString());
    formData.append("discount_amount", discountAmount.toString());
    // Claude code — UI-20: removed hardcoded `created_by=ADMIN`; server uses authenticated actor (see CODE-22).

    const res = await savePurchaseOrder(formData);
    setLoading(false);

    if (res.success) {
      router.push("/admin/inventory/purchase-orders");
      router.refresh();
    } else {
      alert("Lỗi: " + res.error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div>
          <label htmlFor={`${formId}-supplierId`} className="block text-sm font-semibold text-gray-700 mb-2">Nhà Cung Cấp *</label>
          <SearchableSelect
            id={`${formId}-supplierId`}
            value={supplierId}
            onChange={(val) => setSupplierId(val)}
            options={suppliers.map((s: any) => ({ id: s.id, label: s.name }))}
            placeholder="Chọn nhà cung cấp..."
            onCreateNew={(searchTerm) => {
              setNewSupplierName(searchTerm);
              setIsSupplierModalOpen(true);
            }}
          />
        </div>
        <div>
          <label htmlFor={`${formId}-transactionDate`} className="block text-sm font-semibold text-gray-700 mb-2">Ngày nhập hàng thực tế</label>
          <CustomDatePicker
            id={`${formId}-transactionDate`}
            name="transaction_date"
            selected={transactionDate}
            onChange={(date) => setTransactionDate(date)}
            placeholderText="Chọn ngày nhập hàng (dd/mm/yyyy)"
          />
          <p className="text-xs text-gray-500 mt-1">Để trống hệ thống sẽ lấy thời điểm hiện tại.</p>
        </div>
        <div>
          <label htmlFor={`${formId}-sourceId`} className="block text-sm font-semibold text-gray-700 mb-2">Nguồn nhập hàng</label>
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
            <button
              type="button"
              onClick={async () => {
                const name = window.prompt("Nhập tên nguồn mới (VD: Tiktok Shop):");
                if (name && name.trim()) {
                  const res = await addPurchaseSource(name.trim());
                  if (res.success) {
                    alert("Đã thêm nguồn thành công! Vui lòng tải lại trang để cập nhật danh sách.");
                  } else {
                    alert("Lỗi: " + res.error);
                  }
                }
              }}
              className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 border border-indigo-100 whitespace-nowrap"
            >
              + Thêm
            </button>
          </div>
        </div>
        <div>
          <label htmlFor={`${formId}-supplierInvoiceCode`} className="block text-sm font-semibold text-gray-700 mb-2">Mã hoá đơn (Supplier Invoice Code)</label>
          <input
            id={`${formId}-supplierInvoiceCode`}
            type="text"
            value={supplierInvoiceCode}
            onChange={(e) => setSupplierInvoiceCode(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 text-sm"
            placeholder="VD: INV-20231201"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`${formId}-notes`} className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú</label>
          <input
            id={`${formId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú thêm..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-gray-900">Chi Tiết Nhập Hàng</h3>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex flex-col items-center justify-center">
            <p className="text-gray-500 mb-4">Chưa có mặt hàng nào.</p>
            <button
              type="button"
              onClick={addLine}
              className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-6 py-2.5 rounded-lg text-sm font-medium transition"
            >
              + Thêm Mặt Hàng Đầu Tiên
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((line, index) => {
              const itemRowId = `${formId}-item-${index}`;
              const availableUnits = conversions.filter(
                (c: any) => c.purchased_item_id === line.purchased_item_id && c.status !== "INACTIVE"
              );
              const unitPrice = Number(line.quantity) > 0 ? Number(line.subtotal) / Number(line.quantity) : 0;

              return (
                <div key={index} className="p-4 border border-gray-200 rounded-xl relative bg-gray-50/50">
                  <button
                    onClick={() => removeLine(index)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label htmlFor={`${itemRowId}-purchased_item_id`} className="block text-xs font-medium text-gray-500 mb-1">Mặt hàng</label>
                      <SearchableSelect
                        id={`${itemRowId}-purchased_item_id`}
                        value={line.purchased_item_id}
                        onChange={(val) => updateLine(index, "purchased_item_id", val)}
                        options={items.map((i: any) => ({ id: i.id, label: i.name }))}
                        placeholder="-- Chọn Hàng --"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label htmlFor={`${itemRowId}-conversion_id`} className="block text-xs font-medium text-gray-500 mb-1">Đơn vị nhập</label>
                      <div className="space-y-2">
                        <select
                          id={`${itemRowId}-conversion_id`}
                          value={line.conversion_id || ""}
                          onChange={(e) => updateLine(index, "conversion_id", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          disabled={!line.purchased_item_id}
                        >
                          <option value="">-- Chọn --</option>
                          {availableUnits.map((u: any) => {
                            const pUnit = String(u.purchased_unit).trim();
                            const bUnit = String(u.base_unit).trim();
                            const unitName = units.find((x:any)=>x.id===pUnit || x.name===pUnit)?.name || pUnit;
                            const baseUnitName = units.find((x:any)=>x.id===bUnit || x.name===bUnit)?.name || bUnit;
                            return (
                              <option key={u.id} value={u.id}>
                                {unitName} {u.conversion_rate}{baseUnitName}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor={`${itemRowId}-quantity`} className="block text-xs font-medium text-gray-500 mb-1">Số lượng</label>
                      <input
                        id={`${itemRowId}-quantity`}
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor={`${itemRowId}-subtotal`} className="block text-xs font-medium text-gray-500 mb-1">Thành tiền (đ)</label>
                      <input
                        id={`${itemRowId}-subtotal`}
                        type="number"
                        min="0"
                        value={line.subtotal}
                        onChange={(e) => updateLine(index, "subtotal", e.target.value)}
                        className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-emerald-50 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Đơn giá</label>
                      <div className="px-3 py-2 text-sm font-semibold text-gray-400 bg-gray-100 rounded-lg border border-transparent">
                        {formatNumber(unitPrice)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addLine}
              className="mt-4 w-full text-center text-indigo-600 bg-indigo-50 border border-dashed border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 py-3 rounded-xl text-sm font-medium transition"
            >
              + Thêm Mặt Hàng
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end pt-6 border-t border-gray-200">
        <div className="w-full max-w-md mb-6 space-y-3 bg-gray-50 p-5 rounded-xl border border-gray-200">
           <div className="flex justify-between items-center text-sm text-gray-600">
              <span className="font-medium">Tổng tiền hàng:</span>
              <span className="font-semibold text-gray-900">{formatNumber(subtotalAmount)}</span>
           </div>
           
           <div className="space-y-2 pt-2 border-t border-gray-200/60">
             <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Phí vận chuyển (+):</span>
                <input 
                   type="number" 
                   value={shippingFee || ''}
                   onChange={(e) => setShippingFee(Number(e.target.value))}
                   className="w-28 md:w-32 text-right border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Thuế (+):</span>
                <input 
                   type="number" 
                   value={taxAmount || ''}
                   onChange={(e) => setTaxAmount(Number(e.target.value))}
                   className="w-28 md:w-32 text-right border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-500"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Voucher (-):</span>
                <input 
                   type="number" 
                   value={voucherAmount || ''}
                   onChange={(e) => setVoucherAmount(Number(e.target.value))}
                   className="w-28 md:w-32 text-right border border-red-200 bg-red-50 text-red-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 font-medium"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Chiết khấu (-):</span>
                <input 
                   type="number" 
                   value={discountAmount || ''}
                   onChange={(e) => setDiscountAmount(Number(e.target.value))}
                   className="w-28 md:w-32 text-right border border-red-200 bg-red-50 text-red-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 font-medium"
                   placeholder="0"
                 />
             </div>
           </div>

           <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <span className="text-base font-bold text-gray-800">Cần Thanh Toán:</span>
              <span className="text-2xl font-bold text-emerald-600">{formatNumber(totalAmount)}</span>
           </div>
        </div>

        <div className="flex gap-4">
          <LoadingButton
            loading={loading}
            onClick={() => handleSubmit("DRAFT")}
            variant="secondary"
          >
            {isEdit ? "Lưu Nháp" : "Lưu Nháp (Draft)"}
          </LoadingButton>
          <LoadingButton
            loading={loading}
            onClick={() => handleSubmit("COMPLETED")}
            variant="primary"
          >
            {isEdit ? "Cập nhật & Hoàn thành" : "Tạo"}
          </LoadingButton>
        </div>
      </div>

      <datalist id="units-list">
        {units.map((u: any) => (
          <option key={u.id} value={u.name} />
        ))}
      </datalist>

      <SupplierModal 
        isOpen={isSupplierModalOpen} 
        onClose={() => setIsSupplierModalOpen(false)} 
        initialName={newSupplierName}
        onSuccess={(id) => {
          setSupplierId(id);
          router.refresh();
          alert("Đã thêm nhà cung cấp thành công!");
        }}
      />
    </div>
  );
}
