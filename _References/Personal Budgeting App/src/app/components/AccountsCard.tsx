import { Wallet, DollarSign } from "lucide-react";
import { Transaction } from "./AddTransactionSheet";
import { Card } from "./ui/card";

interface AccountsCardProps {
  transactions: Transaction[];
}

export function AccountsCard({ transactions }: AccountsCardProps) {
  // Calculate Current Account balance
  const currentAccountBalance = transactions
    .filter((t) => t.account === "current")
    .reduce((sum, t) => {
      return t.type === "income" ? sum + t.amount : sum - t.amount;
    }, 0);

  // Calculate Savings Account balance
  const savingsAccountBalance = transactions
    .filter((t) => t.account === "savings")
    .reduce((sum, t) => {
      return t.type === "income" ? sum + t.amount : sum - t.amount;
    }, 0);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Wallet className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-sm text-muted-foreground">Current</p>
        </div>
        <p className="font-semibold">
          ${currentAccountBalance.toFixed(2)}
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
            <DollarSign className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-sm text-muted-foreground">Savings</p>
        </div>
        <p className="font-semibold">
          ${savingsAccountBalance.toFixed(2)}
        </p>
      </Card>
    </div>
  );
}
