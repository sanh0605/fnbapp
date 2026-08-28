"use client";

import { useState, useId } from "react";
import { saveProduct, deleteProduct } from "@/app/admin/products/actions";
import { CustomDatePicker } from "./CustomDatePicker";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";
import { Plus, X } from "lucide-react";
import { alert, confirm } from "@/lib/dialog";

export default function ProductForm({ categories, initialData }: any) {
  const isEdit = !!initialData;
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [name, setName] = useState(initialData?.name || "");

  // variants format: { id?: string, size_name: string, price: number }
  const [variants, setVariants] = useState<any[]>(
    initialData?.variants || [{ size_name: "Mặc định", price: 0 }]
  );
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(initialData?.effective_date ? new Date(initialData.effective_date) : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !categoryId) return await alert({ title: "Thiếu thông tin", message: "Vui lòng nhập Tên món và chọn Nhóm.", variant: "warning" });
    if (variants.length === 0) return await alert({ title: "Thiếu thông tin", message: "Phải có ít nhất 1 kích cỡ/size.", variant: "warning" });

    setLoading(true);
    const formData = new FormData();
    if (isEdit) formData.append("id", initialData.id);
    formData.append("category_id", categoryId);
    formData.append("name", name);
    formData.append("variants_json", JSON.stringify(variants));

    const effectiveDateStr = effectiveDate ? effectiveDate.toISOString() : "";
    formData.append("effective_date", effectiveDateStr);

    let res = await saveProduct(formData);
    // Batch 1 follow-up, level 2 (docs/BUSINESS-RULES.md BR-CATALOG-001): a
    // near-match warning, not a refusal -- ask whether it is really a
    // different item, resubmit once on "món khác", stay on the form with
    // nothing saved on "tôi gõ nhầm".
    if ((res as any).needsDuplicateWarning) {
      const approved = await confirm({
        title: "Tên gần giống một mục đã có",
        message: (res as any).needsDuplicateWarning.message,
        okText: "Món khác",
        cancelText: "Tôi gõ nhầm",
        variant: "warning",
      });
      if (approved) {
        formData.append("duplicate_warning_confirmed", "true");
        res = await saveProduct(formData);
      } else {
        setLoading(false);
        return;
      }
    }
    setLoading(false);

    if (res.success) {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setCategoryId("");
        setVariants([{ size_name: "Mặc định", price: 0 }]);
      }
    } else {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", initialData.id);
    const res = await deleteProduct(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      setIsDeleteOpen(false);
    }
  };

  // --- HANDLERS FOR VARIANTS ---
  const addVariant = () => {
    setVariants([...variants, { size_name: "", price: 0 }]);
  };
  const updateVariant = (vIndex: number, field: string, value: any) => {
    const newVars = [...variants];
    newVars[vIndex][field] = value;
    setVariants(newVars);
  };
  const removeVariant = (vIndex: number) => {
    setVariants(variants.filter((_, i) => i !== vIndex));
  };

  return (
    <>
      {!isEdit ? (
        <Button variant="primary" onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Thêm Món Mới
        </Button>
      ) : (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>Sửa</Button>
          <Button variant="ghost" size="sm" className="!text-danger hover:!bg-danger/10" onClick={() => setIsDeleteOpen(true)}>Xoá</Button>
        </div>
      )}

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-card shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex justify-between items-center bg-page">
              <h2 className="text-xl font-bold text-text-primary">
                {isEdit ? "Sửa Món" : "Tạo Món Mới (Product Builder)"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-primary" aria-label="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-page">
              <form id={isEdit ? `editProd-${initialData.id}` : "addProd"} onSubmit={handleSubmit} className="space-y-6 pb-48">

                {/* THÔNG TIN CHUNG */}
                <div className="bg-surface-card p-5 rounded-xl border border-border shadow-sm">
                  <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
                    <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                    Thông Tin Cơ Bản
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`${formId}-name`} className="block text-sm font-bold text-text-primary mb-1">Tên món *</label>
                      <input id={`${formId}-name`} type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-focus-ring bg-surface-card text-text-primary" placeholder="VD: Cà phê sữa đá..." />
                    </div>
                    <div>
                      <label htmlFor={`${formId}-category-id`} className="block text-sm font-bold text-text-primary mb-1">Nhóm món *</label>
                      <select id={`${formId}-category-id`} required value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-focus-ring bg-surface-card text-text-primary">
                        <option value="">-- Chọn nhóm --</option>
                        {categories.map((c:any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <label htmlFor={`${formId}-effective-date`} className="block text-sm font-bold text-text-primary mb-1">Ngày áp dụng giá (Tuỳ chọn)</label>
                    <p className="text-xs text-text-secondary mb-2">Bỏ trống hệ thống sẽ lấy thời gian hiện tại. Dành cho việc cập nhật lịch sử bán hàng cũ.</p>
                    <div className="w-full md:w-1/2">
                      <CustomDatePicker
                        id={`${formId}-effective-date`}
                        name="effective_date"
                        selected={effectiveDate}
                        onChange={(date) => setEffectiveDate(date)}
                        placeholderText="dd/mm/yyyy hh:mm:ss"
                      />
                    </div>
                  </div>
                </div>

                {/* VARIANTS */}
                <div className="bg-surface-card p-5 rounded-xl border border-border shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                      <span className="bg-primary-soft text-primary w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                      Các Kích Cỡ
                    </h3>
                    <Button variant="secondary" size="sm" onClick={addVariant}><Plus className="w-4 h-4 mr-1"/> Thêm Size</Button>
                  </div>

                  <div className="space-y-4">
                    {variants.map((variant, vIdx) => {
                      const variantRowId = `${formId}-variant-${vIdx}`;
                      return (
                        <div key={vIdx} className="bg-page p-4 border border-border rounded-xl flex gap-4 items-end">
                          <div className="flex-1">
                            <label htmlFor={`${variantRowId}-size-name`} className="block text-xs font-bold text-text-secondary uppercase mb-1">Tên Kích cỡ (Size)</label>
                            <input id={`${variantRowId}-size-name`} type="text" required value={variant.size_name} onChange={e => updateVariant(vIdx, "size_name", e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm font-bold focus:ring-focus-ring bg-surface-card text-text-primary" placeholder="VD: Mặc định, Size M..." />
                          </div>
                          <div className="flex-1">
                            <label htmlFor={`${variantRowId}-price`} className="block text-xs font-bold text-text-secondary uppercase mb-1">Giá bán (VNĐ)</label>
                            <input id={`${variantRowId}-price`} type="number" required min="0" value={variant.price} onChange={e => updateVariant(vIdx, "price", e.target.value === "" ? "" : e.target.value)} className="w-full border border-border rounded-md px-3 py-2 text-sm font-bold text-primary focus:ring-focus-ring bg-surface-card" />
                          </div>
                          {variants.length > 1 && (
                            <Button variant="ghost" size="sm" className="!text-danger hover:!bg-danger/10" onClick={() => removeVariant(vIdx)}>Xoá Size</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* End of form */}

              </form>
            </div>

            <div className="p-5 border-t border-border bg-page flex justify-end gap-3 mt-auto">
              <Button variant="secondary" onClick={() => setIsOpen(false)}>Huỷ</Button>
              <Button
                variant="primary"
                type="submit"
                form={isEdit ? `editProd-${initialData.id}` : "addProd"}
                loading={loading}
              >
                Lưu Menu
              </Button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {isDeleteOpen && (
        <DeleteConfirmModal
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          title="Xác nhận xoá"
          description={`Bạn có chắc chắn muốn xoá món ${initialData.name} không? Thao tác này không thể hoàn tác.`}
        />
      )}
    </>
  );
}
