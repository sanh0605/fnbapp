"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCategory } from "@/app/admin/products/categories/actions";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { alert } from "@/lib/shared/dialog";
import type { DBProductCategory } from "@/types/db";

interface DeleteProductCategoryButtonProps {
  category: DBProductCategory;
}

export function DeleteProductCategoryButton({ category }: DeleteProductCategoryButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", category.id);
    const res = await deleteCategory(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Không xoá được", message: res.error, variant: "danger" });
      return;
    }
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-danger hover:text-danger-active font-medium text-sm min-h-[44px] inline-flex items-center"
      >
        {loading ? "..." : "Xóa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`}
      />
    </>
  );
}
