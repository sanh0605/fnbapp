"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { ConversionForm } from "./ConversionForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader 
        title="Quản lý Bảng Quy Đổi" 
        subtitle="Thiết lập tỷ lệ quy đổi từ đơn vị mua hàng sang đơn vị cơ bản dùng trong pha chế."
        actions={rightContent}
      />
      <StickyFilterBar>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm hàng hóa</label>
          <input
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
      </StickyFilterBar>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
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
                  <td colSpan={5} className="p-0">
                    <EmptyState 
                      icon="🔄" 
                      title="Chưa có quy đổi" 
                      description="Thêm quy đổi đơn vị để quản lý nguyên liệu dễ dàng hơn."
                    />
                  </td>
                </tr>
              ) : (
                filteredConversions.map((conv) => (
                  <tr key={conv.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {itemMap[conv.purchased_item_id] || conv.purchased_item_id}
                    </td>
                    <td className="px-6 py-4 text-primary font-bold">
                      {conv.purchased_unit ? unitMap[conv.purchased_unit] : ""}
                      {!conv.purchased_unit && conv.from_unit_id ? unitMap[conv.from_unit_id] : ""}
                    </td>
                    <td className="px-6 py-4 font-mono text-text-muted">
                      x{conv.conversion_rate}
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium">
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

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {filteredConversions.length === 0 ? (
            <EmptyState 
              icon="🔄" 
              title="Chưa có quy đổi" 
              description="Thêm quy đổi đơn vị để quản lý nguyên liệu dễ dàng hơn."
            />
          ) : (
            filteredConversions.map((conv) => (
              <div key={conv.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-text-primary">{itemMap[conv.purchased_item_id] || conv.purchased_item_id}</div>
                </div>
                
                <div className="flex items-center justify-between mt-2 p-3 bg-surface-secondary rounded-lg">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-text-muted uppercase font-bold mb-1">Đơn vị mua</span>
                    <span className="text-sm font-bold text-primary">
                      {conv.purchased_unit ? unitMap[conv.purchased_unit] : ""}
                      {!conv.purchased_unit && conv.from_unit_id ? unitMap[conv.from_unit_id] : ""}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center px-4">
                    <span className="text-text-muted text-xs">→</span>
                    <span className="font-mono text-xs font-bold text-text-secondary">x{conv.conversion_rate}</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-text-muted uppercase font-bold mb-1">Đơn vị chuẩn</span>
                    <span className="text-sm font-bold text-text-secondary">
                      {conv.base_unit ? unitMap[conv.base_unit] : ""}
                      {!conv.base_unit && conv.to_unit_id ? unitMap[conv.to_unit_id] : ""}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
                  <div className="flex items-center min-h-[44px]">
                    <ConversionForm 
                      initialData={conv} 
                      items={items} 
                      baseIngredients={baseIngredients} 
                      units={units} 
                    />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <DeleteConversionButton id={conv.id} itemName={itemMap[conv.purchased_item_id] || ""} />
                  </div>
                </div>
              </div>
            ))
          )}
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
        className="text-danger hover:text-danger-active font-medium text-sm disabled:opacity-50"
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
