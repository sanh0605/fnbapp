import { BankAccountForm } from "../components/BankAccountForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewBankAccountPage(props: { searchParams?: Promise<{ returnTo?: string }> }) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/bank-accounts");
  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Tài khoản ngân hàng"
        title="Tạo tài khoản ngân hàng"
        subtitle="Khai báo tài khoản để ghi các khoản chuyển khoản."
      />
      <BankAccountForm returnTo={returnTo} />
    </DetailFrame>
  );
}
