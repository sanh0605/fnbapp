"use client";

import { useState } from "react";
import { savePurchaseOrder, addPurchaseSource } from "@/app/admin/inventory/purchase-orders/actions";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "./SearchableSelect";
import { SupplierModal } from "./SupplierForm";
import { CustomDatePicker } from "./CustomDatePicker";
import { formatNumber } from "@/lib/format";
import { alert, confirm } from "@/lib/dialog";

export default function PurchaseOrderForm({ suppliers, sources = [], items, conversions, baseIngredients, units = [], initialData }: any) {
  const router = useRouter();
  const isEdit = !!initialData?.po;
  const po = initialData?.po || {};
  const initialLines = initialData?.lines || [];

  const [loading, setLoading] = useState(false);
  const [supplierId, setSupplierId] = useState(po.supplier_id || "");
  const [sourceId, setSourceId] = useState(po.source_id || "");
  const [supplierInvoiceCode, setSupplierInvoiceCode] = useState(po.supplier_invoice_code || "");
  const [transactionDate, setTransactionDate] = useState<Date | null>(po.transaction_date ? new Date(po.transaction_date) : null);
  const [notes, setNotes] = useState(po.notes || "");
  
  // Format initial lines to match form state structure
  const formattedInitialLines = initialLines.map((line: any) => ({
    purchased_item_id: line.purchased_item_id || "",
    unit: line.unit || "",
    quantity: line.quantity || 1,
    subtotal: line.subtotal || 0,
    is_new_unit: false,
    conversion_rate: line.conversion_rate || "",
    base_unit: line.base_unit || "",
    base_ingredient_id: line.base_ingredient_id || "",
    conversion_id: line.conversion_id || ""
  }));

  const [lines, setLines] = useState<any[]>(formattedInitialLines.length > 0 ? formattedInitialLines : []);
  
  // Extra costs
  const [shippingFee, setShippingFee] = useState(po.shipping_fee || 0);
  const [taxAmount, setTaxAmount] = useState(po.tax_amount || 0);
  const [voucherAmount, setVoucherAmount] = useState<number>(po?.voucher_amount || 0);
  const [discountAmount, setDiscountAmount] = useState<number>(po?.discount_amount || 0);
  
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
      if (!supplierId) return await alert({ title: "Thiếu thông tin", message: "Vui lòng chọn nhà cung cấp", variant: "warning" });
      if (lines.length === 0) return await alert({ title: "Thiếu thông tin", message: "Vui lòng thêm ít nhất 1 mặt hàng", variant: "warning" });

      // Validation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.purchased_item_id) return await alert({ title: "Thiếu thông tin", message: `Dòng ${i + 1}: Vui lòng chọn hàng hoá`, variant: "warning" });
        if (!line.unit) return await alert({ title: "Thiếu thông tin", message: `Dòng ${i + 1}: Vui lòng nhập hoặc chọn đơn vị`, variant: "warning" });
        if (!line.conversion_id) return await alert({ title: "Thiếu thông tin", message: `Dòng ${i + 1}: Vui lòng chọn đơn vị`, variant: "warning" });
      }
    }

    setLoading(true);
    const formData = new FormData();
    if (isEdit) formData.append("id", po.id);
    formData.append("supplier_id", supplierId);
    if (transactionDate) formData.append("transaction_date", transactionDate.toISOString());
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
    
    // Hardcode user for now or get from context, assume action handles if missing
    formData.append("created_by", "ADMIN");

    const res = await savePurchaseOrder(formData);
    setLoading(false);

    if (res.success) {
      router.push("/admin/inventory/purchase-orders");
      router.refresh();
    } else {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    }
  };

  return (
    <div className="bg-surface-card rounded-xl shadow-sm border border-border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface-card p-6 rounded-2xl shadow-sm border border-border mb-6">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Nhà Cung Cấp *</label>
          <SearchableSelect
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
          <label className="block text-sm font-semibold text-text-primary mb-2">Ngày nhập hàng thực tế</label>
          <CustomDatePicker
            name="transaction_date"
            selected={transactionDate}
            onChange={(date) => setTransactionDate(date)}
            placeholderText="dd/mm/yyyy hh:mm:ss"
          />
          <p className="text-xs text-text-secondary mt-1">Để trống hệ thống sẽ lấy thời điểm hiện tại.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Nguồn nhập hàng</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <SearchableSelect
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
                    // Update current selected visually, requires page refresh to fully sync list but we can fake it or just refresh
                    await alert({ title: "Thiếu thông tin", message: "Đã thêm nguồn thành công! Vui lòng tải lại trang để cập nhật danh sách.", variant: "warning" });
                  } else {
                    await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
                  }
                }
              }}
              className="px-3 py-2 bg-primary-soft text-primary rounded-lg text-sm font-medium hover:bg-primary-soft border border-indigo-100 whitespace-nowrap"
            >
              + Thêm
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Mã hoá đơn (Supplier Invoice Code)</label>
          <input
            type="text"
            value={supplierInvoiceCode}
            onChange={(e) => setSupplierInvoiceCode(e.target.value)}
            className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring text-sm"
            placeholder="VD: INV-20231201"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold text-text-primary mb-2">Ghi chú</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú thêm..."
            className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold text-text-primary">Chi Tiết Nhập Hàng</h3>
        </div>

        {lines.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-page flex flex-col items-center justify-center">
            <p className="text-text-secondary mb-4">Chưa có mặt hàng nào.</p>
            <button
              type="button"
              onClick={addLine}
              className="text-primary bg-primary-soft hover:bg-primary-soft px-6 py-2.5 rounded-lg text-sm font-medium transition"
            >
              + Thêm Mặt Hàng Đầu Tiên
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((line, index) => {
              const availableUnits = conversions.filter((c: any) => c.purchased_item_id === line.purchased_item_id);
              const unitPrice = Number(line.quantity) > 0 ? Number(line.subtotal) / Number(line.quantity) : 0;

              return (
                <div key={index} className="p-4 border border-border rounded-xl relative bg-page/50">
                  <button
                    onClick={() => removeLine(index)}
                    className="absolute top-4 right-4 text-text-muted hover:text-red-500"
                  >
                    ✕
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Mặt hàng</label>
                      <SearchableSelect
                        value={line.purchased_item_id}
                        onChange={(val) => updateLine(index, "purchased_item_id", val)}
                        options={items.map((i: any) => ({ id: i.id, label: i.name }))}
                        placeholder="-- Chọn Hàng --"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Đơn vị nhập</label>
                      <div className="space-y-2">
                        <select
                          value={line.conversion_id || ""}
                          onChange={(e) => updateLine(index, "conversion_id", e.target.value)}
                          className="w-full border border-border rounded-lg px-3 py-2 text-sm"
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
                      <label className="block text-xs font-medium text-text-secondary mb-1">Số lượng</label>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, "quantity", e.target.value)}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Thành tiền (đ)</label>
                      <input
                        type="number"
                        min="0"
                        value={line.subtotal}
                        onChange={(e) => updateLine(index, "subtotal", e.target.value)}
                        className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-emerald-50 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-text-secondary mb-1">Đơn giá</label>
                      <div className="px-3 py-2 text-sm font-semibold text-text-muted bg-surface-secondary rounded-lg border border-transparent">
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
              className="mt-4 w-full text-center text-primary bg-primary-soft border border-dashed border-indigo-200 hover:bg-primary-soft hover:border-indigo-300 py-3 rounded-xl text-sm font-medium transition"
            >
              + Thêm Mặt Hàng
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end pt-6 border-t border-border">
        <div className="w-full max-w-md mb-6 space-y-3 bg-page p-5 rounded-xl border border-border">
           <div className="flex justify-between items-center text-sm text-text-secondary">
              <span className="font-medium">Tổng tiền hàng:</span>
              <span className="font-semibold text-text-primary">{formatNumber(subtotalAmount)}</span>
           </div>
           
           <div className="space-y-2 pt-2 border-t border-border/60">
             <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Phí vận chuyển (+):</span>
                <input 
                   type="number" 
                   value={shippingFee || ''}
                   onChange={(e) => setShippingFee(Number(e.target.value))}
                   className="w-32 text-right border border-border rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-focus-ring"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Thuế (+):</span>
                <input 
                   type="number" 
                   value={taxAmount || ''}
                   onChange={(e) => setTaxAmount(Number(e.target.value))}
                   className="w-32 text-right border border-border rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-focus-ring"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Voucher (-):</span>
                <input 
                   type="number" 
                   value={voucherAmount || ''}
                   onChange={(e) => setVoucherAmount(Number(e.target.value))}
                   className="w-32 text-right border border-red-200 bg-red-50 text-red-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 font-medium"
                   placeholder="0"
                 />
             </div>
             <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Chiết khấu (-):</span>
                <input 
                   type="number" 
                   value={discountAmount || ''}
                   onChange={(e) => setDiscountAmount(Number(e.target.value))}
                   className="w-32 text-right border border-red-200 bg-red-50 text-red-600 rounded-md px-2 py-1 text-sm focus:ring-1 focus:ring-red-500 font-medium"
                   placeholder="0"
                 />
             </div>
           </div>

           <div className="flex justify-between items-center pt-4 border-t border-border">
              <span className="text-base font-bold text-text-primary">Cần Thanh Toán:</span>
              <span className="text-2xl font-bold text-emerald-600">{formatNumber(totalAmount)}</span>
           </div>
        </div>

        <div className="flex gap-4">
          <button
            disabled={loading}
            onClick={() => handleSubmit("DRAFT")}
            className="px-6 py-2.5 border border-border text-text-primary font-medium rounded-lg hover:bg-page transition"
          >
            Lưu Nháp (Draft)
          </button>
          <button
            disabled={loading}
            onClick={() => handleSubmit("COMPLETED")}
            className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition shadow-sm"
          >
            {loading ? "Đang xử lý..." : "Tạo"}
          </button>
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
        onSuccess={async (id) => {
          setSupplierId(id);
          router.refresh();
          await alert({ title: "Thành công", message: "Đã thêm nhà cung cấp thành công!" });
        }}
      />
    </div>
  );
}
