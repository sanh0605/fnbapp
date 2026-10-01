import Link from "next/link";
import { resolveActor } from "@/lib/auth/auth";
import { getBankAccounts } from "./actions";
import { BankAccountsList } from "./components/BankAccountsList";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage() {
  const [accounts, auth] = await Promise.all([getBankAccounts(), resolveActor()]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tài khoản ngân hàng"
        subtitle="Khai báo tài khoản để ghi các khoản chuyển khoản. Tài khoản đã dùng thì ngừng dùng, không xoá."
        actions={
          <Link
            href="/admin/finance/bank-accounts/new"
            className="bg-primary text-on-primary px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition inline-flex items-center justify-center min-h-[44px]"
          >
            + Thêm tài khoản
          </Link>
        }
      />
      <BankAccountsList accounts={accounts} canDelete={canDelete} />
    </div>
  );
}
