import { UserForm } from "@/app/admin/users/components/UserForm";
import { safeReturnTo } from "@/app/admin/users/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewUserPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhân sự" />
      <PageHeader title="Thêm nhân sự" subtitle="Tạo tài khoản đăng nhập và phân quyền hệ thống." />
      <UserForm returnTo={returnTo} />
    </div>
  );
}
