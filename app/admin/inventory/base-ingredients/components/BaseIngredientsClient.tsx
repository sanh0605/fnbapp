"use client";

import { useState, useMemo } from "react";
import { BaseIngredientForm } from "./BaseIngredientForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader 
        title="Quản lý Nhóm Nguyên Liệu" 
        subtitle="Quản lý các nguyên liệu cơ bản dùng trong pha chế và chế biến."
        actions={rightContent}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Tên nguyên liệu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-48 border border-border rounded-lg px-3 py-3 md:py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
      
      </div>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">ID</th>
                <th className="px-6 py-4 font-bold">Tên Nguyên Liệu</th>
                <th className="px-6 py-4 font-bold">Đơn Vị Cơ Bản</th>
                <th className="px-6 py-4 font-bold">Lưu Kho</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                  <tr key={ing.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-text-muted">{ing.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-text-primary">{ing.name}</div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-medium">
                      {ing.base_unit ? unitMap[ing.base_unit] : ""}
                      {!ing.base_unit && ing.unit_id ? unitMap[ing.unit_id] : ""}
                    </td>
                    <td className="px-6 py-4">
                      {ing.is_non_inventory === "TRUE" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-muted">
                          Phi lưu kho
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary">
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

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-surface-secondary/30">
          {filteredIngredients.length === 0 ? (
            <EmptyState 
              icon="🥚" 
              title="Chưa có nguyên liệu" 
              description="Thêm nguyên liệu cơ bản cho công thức món."
            />
          ) : (
            filteredIngredients.map((ing) => (
              <div key={ing.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-text-primary">{ing.name}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">{ing.id}</div>
                  </div>
                  {ing.is_non_inventory === "TRUE" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-muted">
                      Phi lưu kho
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary border border-primary/20">
                      Có lưu kho
                    </span>
                  )}
                </div>
                <div className="text-sm text-text-secondary">
                  <span className="text-text-muted">Đơn vị:</span> <span className="font-medium">
                    {ing.base_unit ? unitMap[ing.base_unit] : ""}
                    {!ing.base_unit && ing.unit_id ? unitMap[ing.unit_id] : ""}
                  </span>
                </div>
                <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
                  <div className="flex items-center min-h-[44px]">
                    <BaseIngredientForm initialData={ing} units={units} />
                  </div>
                  <div className="flex items-center min-h-[44px]">
                    <DeleteBaseIngredientButton id={ing.id} name={ing.name} />
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
        className="text-danger hover:text-danger-active font-medium text-sm disabled:opacity-50"
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
