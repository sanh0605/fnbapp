"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/format";
import { deleteModifierAction } from "../actions";
import { ModifierForm } from "./ModifierForm";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";
import type { DBModifier } from "@/types/db";
import ToppingsManager from "@/components/ToppingsManager";

interface ModifiersClientProps {
  modifiers: DBModifier[];
  toppings: any[];
}

export default function ModifiersClient({ modifiers, toppings }: ModifiersClientProps) {
  const [activeTab, setActiveTab] = useState<"modifiers" | "standalone">("modifiers");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filteredModifiers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return modifiers;
    return modifiers.filter((m) => (
      m.name.toLowerCase().includes(normalizedSearch) ||
      m.group_name.toLowerCase().includes(normalizedSearch)
    ));
  }, [modifiers, search]);

  const rightContent = (
    <ModifierForm />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topping & Tùy chọn"
        subtitle="Quản lý tùy chọn và cài đặt bán độc lập (POS)."
        actions={activeTab === "modifiers" ? rightContent : undefined}
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="flex bg-surface-secondary p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("modifiers")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "modifiers" ? "bg-surface-card text-primary-active shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Tùy chọn (Modifiers)
          </button>
          <button
            onClick={() => setActiveTab("standalone")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "standalone" ? "bg-surface-card text-primary-active shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            Bán độc lập
          </button>
        </div>

        {activeTab === "modifiers" && (
          <div className="shrink-0 ml-4">
            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm tùy chọn</label>
            <input
              type="text"
              placeholder="Tên hoặc nhóm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
            />
          </div>
        )}

      </div>

      {activeTab === "modifiers" ? (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">Nhóm</th>
                <th className="px-6 py-4 font-bold">Tên Tùy Chọn</th>
                <th className="px-6 py-4 font-bold">Giá Thêm</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredModifiers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-text-muted italic">
                    Không tìm thấy tùy chọn nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredModifiers.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-secondary transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-surface-secondary text-text-secondary uppercase">
                        {m.group_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-text-primary">{m.name}</td>
                    <td className="px-6 py-4 text-warning font-bold">
                      {formatNumber(m.price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <ModifierForm initialData={m} />
                        <DeleteModifierButton id={m.id} name={m.name} onDeleted={() => router.refresh()} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        <ToppingsManager products={toppings} />
      )}
    </div>
  );
}

function DeleteModifierButton({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    await deleteModifierAction(fd);
    setLoading(false);
    onDeleted();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)} disabled={loading} className="text-danger hover:text-danger-active hover:bg-danger/10">{loading ? "..." : "Xóa"}</Button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa tùy chọn "${name}"?`}
      />
    </>
  );
}
