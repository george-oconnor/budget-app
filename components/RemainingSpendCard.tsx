import { Text, View } from "react-native";
import type { Summary, Transaction } from "@/types/type";
import { formatCurrency } from "@/lib/currencyFunctions";

export default function RemainingSpendCard({
  summary,
  transactions,
  loading,
}: {
  summary: Summary | null;
  transactions: Transaction[];
  loading: boolean;
}) {
  const currency = summary?.currency ?? "USD";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const mtdExpenses = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.kind === "expense" && d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budget = summary?.monthlyBudget ?? 0;
  const remaining = Math.max(0, budget - mtdExpenses);
  const progress = budget > 0 ? Math.min(1, mtdExpenses / budget) : 0;

  return (
    <View className="rounded-3xl bg-primary px-5 py-6 shadow-md">
      <Text className="text-white/80 text-sm">Remaining Spend</Text>
      <Text className="text-white text-4xl font-bold mt-1">
        {loading ? "…" : formatCurrency(remaining / 100, currency)}
      </Text>
      <View className="mt-4">
        <View className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
          <View style={{ width: `${progress * 100}%` }} className="h-2 bg-white rounded-full" />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-white/80 text-xs">Spent: {formatCurrency(mtdExpenses / 100, currency)}</Text>
          <Text className="text-white/80 text-xs">Budget: {formatCurrency(budget / 100, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
