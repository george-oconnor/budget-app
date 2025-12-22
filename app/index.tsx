import CategoryChips from "@/components/CategoryChips";
import Header from "@/components/Header";
import IncomeExpenseRow from "@/components/IncomeExpenseRow";
import QuickActions from "@/components/QuickActions";
import RemainingSpendCard from "@/components/RemainingSpendCard";
import TransactionsSection from "@/components/TransactionsSection";
import type { QuickAction } from "@/types/type";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHomeStore } from "../store/useHomeStore";
import { useSessionStore } from "../store/useSessionStore";

const quickActions: QuickAction[] = [
  { id: "add", label: "Add", icon: "plus" },
  { id: "import", label: "Import", icon: "download" },
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
    cycleType,
    cycleDay,
  } = useHomeStore();

  const { user } = useSessionStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Only fetch when user is available
    if (user?.id) {
      fetchHome();
    }
  }, [user?.id, fetchHome]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHome();
    } finally {
      setRefreshing(false);
    }
  };

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
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#667eea"
          />
        }
      >
        <Header name={user?.name} />
        <RemainingSpendCard 
          summary={summary} 
          transactions={transactions} 
          loading={loading}
          cycleType={cycleType}
          cycleDay={cycleDay}
        />
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
