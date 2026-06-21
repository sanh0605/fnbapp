"use client";

import { useState } from "react";
import { addSupplier, deleteSupplier } from "@/app/actions/suppliers";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function SupplierForm({ initialData }: { initialData?: any }) {
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(initialData?.name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [taxId, setTaxId] = useState(initialData?.tax_id || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [links, setLinks] = useState(initialData?.links || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const formData = new FormData();
    if (isEdit) formData.append("id", initialData.id);
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
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setPhone("");
        setTaxId("");
        setAddress("");
        setLinks("");
      }
    }
  }

  return (
    <>
      {!isEdit ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
        >
          + Thêm Nhà Cung Cấp
        </button>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
        >
          Sửa
        </button>
      )}

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900">{isEdit ? "Sửa Nhà Cung Cấp" : "Thêm Nhà Cung Cấp Mới"}</h2>
            
            {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Nhà Cung Cấp *</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
                  placeholder="VD: Cty Cà phê Việt"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
                  <input 
                    type="text" 
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Links / Ghi chú</label>
                <textarea 
                  value={links}
                  onChange={(e) => setLinks(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
                  placeholder="Link đặt hàng, ghi chú..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium transition-colors shadow-sm"
                >
                  {loading ? "Đang lưu..." : "Lưu Thông Tin"}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

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
      if (onSuccess && res.id) onSuccess(res.id);
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-900">Thêm Nhà Cung Cấp Mới</h2>
        
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên Nhà Cung Cấp *</label>
            <input 
              type="text" 
              required 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
              placeholder="VD: Cty Cà phê Việt"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
              <input 
                type="tel" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã số thuế</label>
              <input 
                type="text" 
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <input 
              type="text" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Links / Ghi chú</label>
            <textarea 
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-shadow" 
              placeholder="Link đặt hàng, ghi chú..."
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
            >
              Huỷ
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium transition-colors shadow-sm"
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

export function DeleteSupplierButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const performDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    const res = await deleteSupplier(formData);
    setLoading(false);
    if (res?.error) {
      alert("Lỗi: " + res.error);
    } else {
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsDeleteOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
      >
        {loading ? "..." : "Xoá"}
      </button>

      {isDeleteOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 text-left">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-red-50/50">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                Xác nhận xoá
              </h2>
            </div>
            <div className="p-5">
              <p className="text-gray-600 text-sm text-left">
                Bạn có chắc chắn muốn xoá nhà cung cấp này không?<br/>
                Các liên kết hàng hoá có thể bị ảnh hưởng.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">
                Huỷ
              </button>
              <button 
                type="button" 
                onClick={performDelete} 
                disabled={loading} 
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Xác nhận xoá"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
