"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { deleteUserAction } from "@/app/admin/users/actions";
import { RoleBadge } from "@/app/admin/users/components/RoleBadge";
import { staffLabel } from "@/lib/auth/staff-label";
import type { DBUser } from "@/types/db";

export interface UserDetailViewProps {
  user: DBUser;
  returnTo: string;
  canDelete: boolean;
  canGrantAdmin?: boolean;
}

export function UserDetailView({
  user,
  returnTo,
  canDelete,
  canGrantAdmin = true,
}: UserDetailViewProps) {
  const currentDetailUrl = `/admin/users/${encodeURIComponent(user.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/users/${encodeURIComponent(user.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;
  const canEdit = canGrantAdmin || user.role !== "ADMIN";
  const { name, showLogin } = staffLabel(user);

  const fields: Field[] = [
    { label: "Mã NV", value: user.id },
    { label: "Tên đăng nhập", value: user.username },
    { label: "Quyền hạn", value: <RoleBadge role={user.role} /> },
    { label: "Ngày tạo", value: formatDateTimeFull(user.created_at) || "—" },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
      )}
      {canDelete && user.username !== "admin" && (
        <RemoveRecordButton
          verb="Xoá"
          name={name}
          confirmMessage={`Bạn có chắc chắn muốn xoá nhân sự "${name}"? Không thể hoàn tác.`}
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
        title={name}
        subtitle={showLogin ? `${user.username} · ${user.id}` : user.id}
        actions={headerActions}
      />
      <FieldList fields={fields} />
    </DetailFrame>
  );
}
