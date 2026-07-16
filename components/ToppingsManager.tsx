"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleToppingStandalone } from "@/app/admin/products/toppings/actions";
import type { DBProduct } from "@/types/db";
import { alert, confirm } from "@/lib/dialog";

interface ToppingsManagerProps {
  products: DBProduct[]; // đã filter CAT-007 + có topping standalone flag
}

export default function ToppingsManager({ products }: ToppingsManagerProps) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function handleToggle(productId: string, enabled: boolean) {
    setPending(productId);
    const res = await toggleToppingStandalone(productId, enabled);
    if (!res.ok) {
      await alert({ title: "Lỗi", message: res.error || "Có lỗi xảy ra khi bật/tắt topping.", variant: "danger" });
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Desktop Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-6 py-4 font-bold">Tên Modifier</th>
                <th className="px-6 py-4 font-bold">Sản phẩm Topping (Standalone)</th>
                <th className="px-6 py-4 font-bold text-center">Bán độc lập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-text-secondary italic">
                    Chưa có topping standalone nào.
                  </td>
                </tr>
              ) : (
                products.map(product => {
                  const isActive = product.status === "ACTIVE";
                  const isPending = pending === product.id;
                  return (
                    <tr key={product.id} className="hover:bg-page/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-text-primary">{product.name}</td>
                      <td className="px-6 py-4 font-mono text-[11px] text-text-secondary">{product.id}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <button
                            role="switch"
                            aria-checked={isActive}
                            disabled={isPending}
                            onClick={() => handleToggle(product.id, !isActive)}
                            className="relative flex h-[44px] w-[60px] items-center justify-center disabled:opacity-50 focus:outline-none"
                            aria-label={`Bật/tắt bán độc lập cho ${product.name}`}
                          >
                            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              isActive ? 'bg-blue-600' : 'bg-border'
                            }`}>
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                                  isActive ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </div>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout (< 768px) */}
        <div className="md:hidden flex flex-col gap-3 p-4 bg-page/30">
          {products.length === 0 ? (
            <div className="text-center text-text-secondary italic py-8">
              Chưa có topping standalone nào.
            </div>
          ) : (
            products.map(product => {
              const isActive = product.status === "ACTIVE";
              const isPending = pending === product.id;
              return (
                <div key={product.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
                  <div>
                    <div className="font-bold text-text-primary">{product.name}</div>
                    <div className="text-[11px] font-mono text-text-muted mt-0.5">
                      {product.id}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-border/50">
                    <span className="text-sm font-medium text-text-primary">Bán độc lập</span>
                    <button
                      role="switch"
                      aria-checked={isActive}
                      disabled={isPending}
                      onClick={() => handleToggle(product.id, !isActive)}
                      className="relative flex h-[44px] w-[60px] items-center justify-end pr-1 disabled:opacity-50 focus:outline-none"
                      aria-label={`Bật/tắt bán độc lập cho ${product.name}`}
                    >
                      <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isActive ? 'bg-blue-600' : 'bg-border'
                      }`}>
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                            isActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
