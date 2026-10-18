import { UserForm } from "@/app/admin/users/components/UserForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function NewUserPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const auth = await resolveActor();
  const canGrantAdmin = Boolean(
    auth.ok && (auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM")
  );
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/users");
  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhân viên & quyền"
        title="Tạo nhân viên"
        subtitle="Tạo tài khoản đăng nhập và phân quyền hệ thống."
      />
      <UserForm returnTo={returnTo} canGrantAdmin={canGrantAdmin} />
    </DetailFrame>
  );
}
