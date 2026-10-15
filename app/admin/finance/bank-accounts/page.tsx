import { Suspense } from "react";
import { getBankAccounts } from "./actions";
import BankAccountsClient from "./components/BankAccountsClient";

export const dynamic = "force-dynamic";

export default async function BankAccountsPage(
  props: {
    searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const accounts = await getBankAccounts();

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <BankAccountsClient
        accounts={accounts}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
