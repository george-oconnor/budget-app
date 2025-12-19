import CategoryChips from "@/components/CategoryChips";
import Header from "@/components/Header";
import IncomeExpenseRow from "@/components/IncomeExpenseRow";
import QuickActions from "@/components/QuickActions";
import RemainingSpendCard from "@/components/RemainingSpendCard";
import TransactionsSection from "@/components/TransactionsSection";
import type { QuickAction } from "@/types/type";
import { useEffect, useMemo } from "react";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHomeStore } from "../store/useHomeStore";
import { useSessionStore } from "../store/useSessionStore";

const quickActions: QuickAction[] = [
  { id: "add", label: "Add", icon: "plus" },
  { id: "analytics", label: "Stats", icon: "bar-chart-2" },
];


export default function Index() {
  const {
    summary,
    transactions,
    categories,
    selectedCategory,
    loading,
    fetchHome,
    setCategory,
  } = useHomeStore();

  const { user } = useSessionStore();

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  const filteredTx = useMemo(() => {
    if (selectedCategory === "all") return transactions;
    return transactions.filter((t) => t.categoryId === selectedCategory);
  }, [selectedCategory, transactions]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Header name={user?.name} />
        <RemainingSpendCard summary={summary} transactions={transactions} loading={loading} />
        <IncomeExpenseRow summary={summary} loading={loading} />
        <CategoryChips
          categories={categories}
          selected={selectedCategory}
          onSelect={setCategory}
        />
        <QuickActions actions={quickActions} />
        <TransactionsSection transactions={filteredTx} categories={categories} currency={summary?.currency ?? "USD"} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}
