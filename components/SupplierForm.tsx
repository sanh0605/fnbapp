"use client";

import { useState, useId } from "react";
import { addSupplier } from "@/app/admin/suppliers/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function SupplierModal({
  isOpen,
  onClose,
  initialName,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  onSuccess?: (id: string) => void;
}) {
  const formId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [links, setLinks] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const formData = new FormData();
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("tax_id", taxId);
    formData.append("address", address);
    formData.append("links", links);

    const res = await addSupplier(formData);
    setLoading(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      if (onSuccess && typeof res.id === "string") onSuccess(res.id);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
      <div className="bg-surface-card rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-text-primary">Thêm Nhà Cung Cấp Mới</h2>
        
        {error && <div className="mb-4 bg-danger/10 text-danger p-3 rounded-lg text-sm border border-danger/30">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-primary mb-1">Tên Nhà Cung Cấp *</label>
            <input 
              id={`${formId}-name`}
              type="text" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring transition-shadow" 
              placeholder="VD: Cty Cà phê Việt"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-phone`} className="block text-sm font-medium text-text-primary mb-1">Số điện thoại</label>
              <input 
                id={`${formId}-phone`}
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring transition-shadow" 
              />
            </div>
            <div>
              <label htmlFor={`${formId}-tax-id`} className="block text-sm font-medium text-text-primary mb-1">Mã số thuế</label>
              <input 
                id={`${formId}-tax-id`}
                type="text" 
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring transition-shadow" 
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-address`} className="block text-sm font-medium text-text-primary mb-1">Địa chỉ</label>
            <input 
              id={`${formId}-address`}
              type="text" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring transition-shadow" 
            />
          </div>
          <div>
            <label htmlFor={`${formId}-links`} className="block text-sm font-medium text-text-primary mb-1">Links / Ghi chú</label>
            <textarea 
              id={`${formId}-links`}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={2}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-2 focus:ring-focus-ring transition-shadow" 
              placeholder="Link đặt hàng, ghi chú..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition-colors"
            >
              Huỷ
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium transition-colors shadow-sm"
            >
              {loading ? "Đang lưu..." : "Lưu Thông Tin"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
