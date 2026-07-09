"use client";

import { useState, useMemo } from "react";
import StickyFilterBar from "@/components/StickyFilterBar";
import { BaseIngredientForm } from "./BaseIngredientForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteBaseIngredientAction } from "../actions";
import type { DBBaseIngredient, DBUnit } from "@/types/db";

interface BaseIngredientsClientProps {
  ingredients: DBBaseIngredient[];
  units: DBUnit[];
}

export default function BaseIngredientsClient({ ingredients, units }: BaseIngredientsClientProps) {
  const [search, setSearch] = useState("");

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) =>
      ing.name.toLowerCase().includes(search.toLowerCase()) ||
      ing.id.toLowerCase().includes(search.toLowerCase())
    );
  }, [ingredients, search]);

  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach(u => map[u.id] = u.name);
    return map;
  }, [units]);

  const rightContent = <BaseIngredientForm units={units} />;

  return (
    <div className="space-y-6">
      <StickyFilterBar 
        title="Quản lý Nhóm Nguyên Liệu" 
        subtitle="Quản lý các nguyên liệu cơ bản dùng trong pha chế và chế biến."
        rightContent={rightContent}
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên nguyên liệu..."
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
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Nguyên Liệu</th>
                <th className="px-6 py-4 font-bold">Đơn Vị Cơ Bản</th>
                <th className="px-6 py-4 font-bold">Lưu Kho</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredIngredients.length === 0 ? (
                <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState 
                    icon="🥚" 
                    title="Chưa có nguyên liệu" 
                    description="Thêm nguyên liệu cơ bản cho công thức món."
                  />
                </td>
              </tr>
              ) : (
                filteredIngredients.map((ing) => (
                  <tr key={ing.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-400">{ing.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{ing.name}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {ing.base_unit ? unitMap[ing.base_unit] : ""}
                      {!ing.base_unit && ing.unit_id ? unitMap[ing.unit_id] : ""}
                    </td>
                    <td className="px-6 py-4">
                      {ing.is_non_inventory === "TRUE" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                          Phi lưu kho
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                          Có lưu kho
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center">
                        <BaseIngredientForm initialData={ing} units={units} />
                        <DeleteBaseIngredientButton id={ing.id} name={ing.name} />
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

function DeleteBaseIngredientButton({ id, name }: { id: string; name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteBaseIngredientAction(fd);
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
        description={`Bạn có chắc chắn muốn xóa nguyên liệu "${name}"? Thao tác này có thể ảnh hưởng đến các công thức và danh mục mua hàng.`}
      />
    </>
  );
}
