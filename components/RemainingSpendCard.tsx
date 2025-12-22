import { getCycleStartDate } from "@/lib/budgetCycle";
import { formatCurrency } from "@/lib/currencyFunctions";
import type { Summary, Transaction } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function RemainingSpendCard({
  summary,
  transactions,
  loading,
  cycleType = "first_working_day",
  cycleDay,
}: {
  summary: Summary | null;
  transactions: Transaction[];
  loading: boolean;
  cycleType?: "first_working_day" | "last_working_day" | "specific_date" | "last_friday";
  cycleDay?: number;
}) {
  const currency = summary?.currency ?? "USD";
  const now = new Date();
  
  // Calculate cycle start date
  const cycleStart = getCycleStartDate(cycleType, cycleDay);
  
  // Filter expenses in current cycle
  const cycleExpenses = transactions
    .filter((t) => {
      const d = new Date(t.date);
      return t.kind === "expense" && d >= cycleStart && d <= now;
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budget = summary?.monthlyBudget ?? 0;
  const remaining = budget - cycleExpenses;
  const isOverspent = remaining < 0;
  const displayRemaining = Math.abs(remaining);
  const progress = budget > 0 ? Math.min(1, cycleExpenses / budget) : 0;
  const noBudgetSet = budget === 0;
  const [pressed, setPressed] = useState(false);

  if (noBudgetSet) {
    return (
      <Pressable 
        onPress={() => {
          console.log("Budget card pressed, navigating to /set-budget");
          router.push("/set-budget");
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <View className={`rounded-3xl bg-primary px-5 py-6 shadow-md items-center justify-center min-h-32 ${pressed ? "opacity-70" : "opacity-100"}`}>
          <Text className="text-white text-lg font-semibold">No budget set</Text>
          <Text className="text-white/80 text-sm mt-2">Set up a monthly budget to get started</Text>
          <View className="mt-4 px-6 py-2 rounded-lg bg-white/20">
            <Text className="text-white text-sm font-semibold">Tap to set budget →</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const bgColor = isOverspent ? "bg-red-600" : "bg-primary";

  return (
    <View className={`rounded-3xl ${bgColor} px-5 py-6 shadow-md`}>
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-white/80 text-sm">
          {isOverspent ? "Overspent" : "Remaining Spend"}
        </Text>
        <Pressable 
          onPress={() => router.push("/set-budget")}
          className="p-2 rounded-full active:bg-white/20"
        >
          <Feather name="edit-2" size={18} color="white" />
        </Pressable>
      </View>
      <Text className="text-white text-4xl font-bold mt-1">
        {loading ? "…" : `${isOverspent ? "-" : ""}${formatCurrency(displayRemaining / 100, currency)}`}
      </Text>
      <View className="mt-4">
        <View className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
          <View style={{ width: `${progress * 100}%` }} className={`h-2 ${isOverspent ? "bg-red-300" : "bg-white"} rounded-full`} />
        </View>
        <View className="flex-row justify-between mt-2">
          <Text className="text-white/80 text-xs">Spent: {formatCurrency(cycleExpenses / 100, currency)}</Text>
          <Text className="text-white/80 text-xs">Budget: {formatCurrency(budget / 100, currency)}</Text>
        </View>
      </View>
    </View>
  );
}
