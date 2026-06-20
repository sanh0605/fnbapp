"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { ConversionForm } from "./ConversionForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { deleteConversionAction } from "../actions";
import type { DBUOMConversion, DBPurchasedItem, DBBaseIngredient, DBUnit } from "@/types/db";

interface ConversionsClientProps {
  baseIngredients: DBBaseIngredient[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
}

export default function ConversionsClient({ baseIngredients, items, conversions, units }: ConversionsClientProps) {
  const [search, setSearch] = useState("");

  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach(u => map[u.id] = u.name);
    return map;
  }, [units]);

  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach(i => map[i.id] = i.name);
    return map;
  }, [items]);

  const filteredConversions = useMemo(() => {
    return conversions.filter((conv) => {
      const itemName = itemMap[conv.purchased_item_id] || "";
      return itemName.toLowerCase().includes(search.toLowerCase());
    });
  }, [conversions, search, itemMap]);

  const rightContent = (
    <ConversionForm 
      items={items} 
      baseIngredients={baseIngredients} 
      units={units} 
    />
  );

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Bảng Quy Đổi" 
        subtitle="Thiết lập tỷ lệ quy đổi từ đơn vị mua hàng sang đơn vị cơ bản dùng trong pha chế."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm hàng hóa</label>
          <input
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
          />
        </div>
      </StickyFilterBar>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-bold">Hàng Hóa (Mua vào)</th>
                <th className="px-6 py-4 font-bold">Đơn Vị Mua</th>
                <th className="px-6 py-4 font-bold">Tỷ Lệ</th>
                <th className="px-6 py-4 font-bold">Đơn Vị Cơ Bản</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredConversions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy quy đổi nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredConversions.map((conv) => (
                  <tr key={conv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {itemMap[conv.purchased_item_id] || conv.purchased_item_id}
                    </td>
                    <td className="px-6 py-4 text-blue-600 font-bold">
                      {conv.purchased_unit ? unitMap[conv.purchased_unit] : ""}
                      {!conv.purchased_unit && conv.from_unit_id ? unitMap[conv.from_unit_id] : ""}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      x{conv.conversion_rate}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {conv.base_unit ? unitMap[conv.base_unit] : ""}
                      {!conv.base_unit && conv.to_unit_id ? unitMap[conv.to_unit_id] : ""}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center">
                        <ConversionForm 
                          initialData={conv} 
                          items={items} 
                          baseIngredients={baseIngredients} 
                          units={units} 
                        />
                        <DeleteConversionButton id={conv.id} itemName={itemMap[conv.purchased_item_id] || ""} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DeleteConversionButton({ id, itemName }: { id: string; itemName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteConversionAction(fd);
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
      >
        {loading ? "..." : "Xóa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa quy đổi của hàng hóa "${itemName}"? Thao tác này có thể ảnh hưởng đến cách tính toán tồn kho từ các đơn hàng mới.`}
      />
    </>
  );
}
