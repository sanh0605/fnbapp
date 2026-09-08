"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/shared/format";
import { deleteModifierAction } from "../actions";
import { ModifierForm } from "./ModifierForm";
import { StandaloneToppingSwitch } from "./StandaloneToppingSwitch";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";
import { alert } from "@/lib/shared/dialog";
import type { DBModifier } from "@/types/db";

interface ModifiersClientProps {
  modifiers: DBModifier[];
  toppings: any[];
}

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 1. One table,
// not two tabs -- "Bán độc lập" is a property of a tùy chọn (a switch on its
// row), not a separate list of something else. The BR-CATALOG-003 join
// (modifiers.product_id) makes this map possible: a tab that used to be its
// own screen (ToppingsManager.tsx) collapses into one column here.
export default function ModifiersClient({ modifiers, toppings }: ModifiersClientProps) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const productStatusById = useMemo(
    () => new Map(toppings.map((t: any) => [t.id, t.status])),
    [toppings],
  );

  const filteredModifiers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return modifiers;
    return modifiers.filter((m) => (
      m.name.toLowerCase().includes(normalizedSearch) ||
      m.group_name.toLowerCase().includes(normalizedSearch)
    ));
  }, [modifiers, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Topping & Tùy chọn"
        subtitle="Quản lý tùy chọn và cài đặt bán độc lập (POS)."
        actions={<ModifierForm />}
      />

      <div className="shrink-0">
        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm tùy chọn</label>
        <input
          type="text"
          placeholder="Tên hoặc nhóm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
        />
      </div>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Desktop: real table, compared by column -- .claude/rules/ui-devices.md */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">Nhóm</th>
                <th className="px-6 py-4 font-bold">Tên Tùy Chọn</th>
                <th className="px-6 py-4 font-bold">Giá Thêm</th>
                <th className="px-6 py-4 font-bold text-center">Bán độc lập</th>
                <th className="px-6 py-4 font-bold text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredModifiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted italic">
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
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <StandaloneToppingSwitch
                          modifierId={m.id}
                          modifierName={m.name}
                          groupName={m.group_name}
                          price={m.price}
                          productId={m.product_id}
                          productStatus={
                            m.product_id ? productStatusById.get(m.product_id) : undefined
                          }
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <ModifierForm
                          initialData={m}
                          productStatus={m.product_id ? productStatusById.get(m.product_id) : undefined}
                        />
                        <DeleteModifierButton id={m.id} name={m.name} onDeleted={() => router.refresh()} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: vertical cards, no horizontal table -- .claude/rules/ui-devices.md */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-page/30">
          {filteredModifiers.length === 0 ? (
            <div className="text-center text-text-muted italic py-8">
              Không tìm thấy tùy chọn nào phù hợp.
            </div>
          ) : (
            filteredModifiers.map((m) => (
              <div key={m.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-surface-secondary text-text-secondary uppercase">
                      {m.group_name}
                    </span>
                    <div className="font-bold text-text-primary mt-1">{m.name}</div>
                  </div>
                  <div className="text-warning font-bold shrink-0">
                    {formatNumber(m.price)}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 mt-1 border-t border-border/50">
                  <span className="text-sm font-medium text-text-primary">Bán độc lập</span>
                  <StandaloneToppingSwitch
                    modifierId={m.id}
                    modifierName={m.name}
                    groupName={m.group_name}
                    price={m.price}
                    productId={m.product_id}
                    productStatus={
                      m.product_id ? productStatusById.get(m.product_id) : undefined
                    }
                  />
                </div>

                <div className="flex justify-end items-center gap-1 pt-1">
                  <ModifierForm initialData={m} />
                  <DeleteModifierButton id={m.id} name={m.name} onDeleted={() => router.refresh()} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteModifierButton({ id, name, onDeleted }: { id: string; name: string; onDeleted: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // section A4b: the action's result was discarded -- a refusal failed in
  // total silence (onDeleted, which calls router.refresh(), was already
  // correct; it just ran unconditionally, even on failure).
  async function handleDelete() {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    const res = await deleteModifierAction(fd);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Không xoá được", message: res.error, variant: "danger" });
      return;
    }
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
