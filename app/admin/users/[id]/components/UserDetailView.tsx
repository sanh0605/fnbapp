"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatDate } from "@/lib/shared/datetime";
import { deleteUserAction } from "@/app/admin/users/actions";
import { RoleBadge } from "@/app/admin/users/components/RoleBadge";
import type { DBUser } from "@/types/db";

export interface UserDetailViewProps {
  user: DBUser;
  returnTo: string;
  canDelete: boolean;
}

export function UserDetailView({
  user,
  returnTo,
  canDelete,
}: UserDetailViewProps): JSX.Element {
  const currentDetailUrl = `/admin/users/${encodeURIComponent(user.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/users/${encodeURIComponent(user.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const fields: Field[] = [
    { label: "Mã NV", value: user.id },
    { label: "Tên đăng nhập", value: user.username },
    { label: "Quyền hạn", value: <RoleBadge role={user.role} /> },
    { label: "Ngày tạo", value: user.created_at ? formatDate(user.created_at) : "—" },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={editHref}
        className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
      >
        Chỉnh sửa
      </Link>
      {canDelete && user.username !== "admin" && (
        <RemoveRecordButton
          verb="Xoá"
          name={user.username}
          confirmMessage={`Bạn có chắc chắn muốn xoá nhân sự "${user.username}"? Không thể hoàn tác.`}
          remove={async () => {
            const fd = new FormData();
            fd.set("id", user.id);
            const res = await deleteUserAction(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return {};
          }}
          afterHref={returnTo}
        />
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhân viên & quyền"
        title={user.username}
        subtitle={user.id}
        actions={headerActions}
      />
      <FieldList fields={fields} />
    </DetailFrame>
  );
}
