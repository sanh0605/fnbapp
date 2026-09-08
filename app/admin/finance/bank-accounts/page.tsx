import { resolveActor } from "@/lib/auth/auth";
import { getBankAccounts } from "./actions";
import { BankAccountsList } from "./components/BankAccountsList";
import { BankAccountForm } from "./components/BankAccountForm";
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
        actions={<BankAccountForm />}
      />
      <BankAccountsList accounts={accounts} canDelete={canDelete} />
    </div>
  );
}
