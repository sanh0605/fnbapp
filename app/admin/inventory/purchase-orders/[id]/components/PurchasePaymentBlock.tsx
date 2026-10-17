import type { DBBankAccount } from "@/types/db";

export interface PurchasePaymentBlockProps {
  paymentMethod?: "CASH" | "BANK_TRANSFER" | null;
  bankAccountId?: string | null;
  bankAccounts: DBBankAccount[];
}

export function PurchasePaymentBlock({
  paymentMethod,
  bankAccountId,
  bankAccounts,
}: PurchasePaymentBlockProps) {
  const currentLabel =
    paymentMethod === "CASH"
      ? "Tiền mặt"
      : paymentMethod === "BANK_TRANSFER"
      ? "Chuyển khoản"
      : "—";

  const currentAccount = bankAccounts.find((a) => a.id === bankAccountId);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm text-text-secondary">
        <span>Hình thức thanh toán:</span>
        <span className="font-medium text-text-primary">
          {currentLabel}
          {paymentMethod === "BANK_TRANSFER" && currentAccount ? ` (${currentAccount.name})` : ""}
        </span>
      </div>
    </div>
  );
}

export default PurchasePaymentBlock;
