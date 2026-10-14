"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { deleteProductType } from "@/app/admin/products/types/actions";
import type { DBProductType } from "@/types/db";

export interface ProductTypeDetailViewProps {
  type: DBProductType;
  categoryNames: string[];
  canDelete: boolean;
  returnTo: string;
}

export function ProductTypeDetailView({
  type,
  categoryNames,
  canDelete,
  returnTo,
}: ProductTypeDetailViewProps): JSX.Element {
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/products/types/${encodeURIComponent(type.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/types/${encodeURIComponent(type.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const groupsText =
    categoryNames.length > 0
      ? categoryNames.join(", ")
      : "Chưa có nhóm nào";

  const fields: Field[] = [
    { label: "Mã", value: type.id },
    { label: "Tên loại", value: type.name },
    { label: "Tính là ly", value: type.is_drink ? "Có" : "Không" },
    { label: "Nhóm món đang dùng", value: groupsText },
  ];

  async function handleDelete() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const fd = new FormData();
      fd.append("id", type.id);
      const res = await deleteProductType(fd);
      if (res?.error) {
        setDeleteError(res.error);
        setIsConfirmingDelete(false);
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } catch {
      setDeleteError("Không xoá được. Kiểm tra mạng rồi bấm lại.");
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Sửa
        </Button>
        {canDelete && !isConfirmingDelete && (
          <Button
            type="button"
            variant="delete"
            onClick={() => {
              setDeleteError(null);
              setIsConfirmingDelete(true);
            }}
          >
            Xoá
          </Button>
        )}
        {canDelete && isConfirmingDelete && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-surface-secondary border border-border rounded-lg">
            <span className="text-sm font-medium text-text-primary">
              Xoá loại món này?
            </span>
            <Button
              type="button"
              variant="delete"
              loading={isDeleting}
              onClick={handleDelete}
            >
              Xoá
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setIsConfirmingDelete(false)}
            >
              Bỏ
            </Button>
          </div>
        )}
      </div>
      {deleteError && (
        <Alert variant="danger">
          {deleteError}
        </Alert>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Loại món"
        title={type.name}
        subtitle={type.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {/* Section: Nhóm món đang dùng */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Nhóm món ({categoryNames.length})
        </h2>

        {categoryNames.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có nhóm nào dùng loại món này.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Tên nhóm món</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {categoryNames.map((name) => (
                    <TableRow key={name}>
                      <TableCell>{name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {categoryNames.map((name) => (
                <div key={name} className="p-4 text-text-primary text-sm font-normal">
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
