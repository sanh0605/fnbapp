"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pauseProduct, resumeProduct, eraseProduct } from "@/app/admin/products/actions";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { Button } from "@/components/ui/Button";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";

interface ProductRowActionsProps {
  product: {
    id: string;
    name: string;
    status: string;
    neverSold: boolean;
    [key: string]: any;
  };
  canDelete: boolean;
  returnTo?: string;
}

export function ProductRowActions({
  product,
  canDelete,
  returnTo: rawReturnTo,
}: ProductRowActionsProps) {
  const router = useRouter();
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products");
  const [isEraseOpen, setIsEraseOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const handlePause = async () => {
    setStatusLoading(true);
    const formData = new FormData();
    formData.append("id", product.id);
    const res = await pauseProduct(formData);
    setStatusLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      router.refresh();
    }
  };

  const handleResume = async () => {
    setStatusLoading(true);
    const formData = new FormData();
    formData.append("id", product.id);
    const res = await resumeProduct(formData);
    setStatusLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      router.refresh();
    }
  };

  const handleErase = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", product.id);
    const res = await eraseProduct(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      setIsEraseOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <div className="flex justify-end gap-2 items-center">
        <Link
          href={`/admin/products/${encodeURIComponent(product.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`}
          className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-text-primary hover:bg-surface-secondary min-h-[44px]"
        >
          Sửa
        </Link>
        {product.status === "ACTIVE" ? (
          <Button variant="ghost" size="sm" onClick={handlePause} loading={statusLoading} className="min-h-[44px]">
            Ngừng bán
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={handleResume} loading={statusLoading} className="min-h-[44px]">
            Bán lại
          </Button>
        )}
        {product.neverSold && canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="!text-danger hover:!bg-danger/10 min-h-[44px]"
            onClick={() => setIsEraseOpen(true)}
          >
            Xoá vĩnh viễn
          </Button>
        )}
      </div>

      {isEraseOpen && (
        <DeleteConfirmModal
          isOpen={isEraseOpen}
          onClose={() => setIsEraseOpen(false)}
          onConfirm={handleErase}
          title="Xác nhận xoá vĩnh viễn"
          description={`Xoá vĩnh viễn món "${product.name}"? Toàn bộ lịch sử giá và size của món này sẽ mất theo. Việc này KHÔNG THỂ hoàn tác.`}
        />
      )}
    </>
  );
}

export default ProductRowActions;
