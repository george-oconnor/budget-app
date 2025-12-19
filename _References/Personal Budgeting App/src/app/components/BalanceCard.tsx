import { Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { Transaction } from "./AddTransactionSheet";
import { Card } from "./ui/card";

interface BalanceCardProps {
  transactions: Transaction[];
}

export function BalanceCard({ transactions }: BalanceCardProps) {
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();

  const monthlyIncome = transactions
    .filter((t) => {
      const date = new Date(t.date);
      return (
        t.type === "income" &&
        date.getMonth() === thisMonth &&
        date.getFullYear() === thisYear
      );
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = transactions
    .filter((t) => {
      const date = new Date(t.date);
      return (
        t.type === "expense" &&
        date.getMonth() === thisMonth &&
        date.getFullYear() === thisYear
      );
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const remainingToSpend = monthlyIncome - monthlyExpenses;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-6">
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="h-5 w-5" />
          <p className="text-sm opacity-90">Remaining This Month</p>
        </div>
        <p className="text-4xl font-bold">${remainingToSpend.toFixed(2)}</p>
        <p className="text-sm opacity-75 mt-2">
          {monthlyIncome > 0 && `Income: $${monthlyIncome.toFixed(2)} • `}
          Spent: ${monthlyExpenses.toFixed(2)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <TrendingDown className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">Income</p>
          </div>
          <p className="font-semibold text-green-600">
            +${monthlyIncome.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
              <TrendingUp className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-sm text-muted-foreground">Expenses</p>
          </div>
          <p className="font-semibold text-red-600">
            -${monthlyExpenses.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">This month</p>
        </Card>
      </div>
    </div>
  );
}