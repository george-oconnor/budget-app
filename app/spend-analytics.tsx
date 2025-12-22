import SpendingOverTimeChart from "@/components/SpendingOverTimeChart";
import { getCycleBudgetStats } from "@/lib/budgetCycle";
import { formatCurrency } from "@/lib/currencyFunctions";
import { useHomeStore } from "@/store/useHomeStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, TouchableWithoutFeedback, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


export default function SpendAnalytics() {
  const { summary, transactions, categories, loading, cycleType, cycleDay } = useHomeStore();
  const [isDraggingChart, setIsDraggingChart] = useState(false);
  const [viewMode, setViewMode] = useState<"category" | "daily">("category");
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedGraphDate, setSelectedGraphDate] = useState<string | null>(null);
  const dropdownAnim = useRef(new Animated.Value(0)).current;
  const budget = summary?.monthlyBudget ?? 0;
  const currency = summary?.currency ?? "USD";

  // Animate dropdown open/close
  useEffect(() => {
    Animated.spring(dropdownAnim, {
      toValue: showViewDropdown ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();
  }, [showViewDropdown]);

  // Calculate budget statistics for the current cycle
  const { expenses: cycleExpenses, remaining, isOverspent, progress } = getCycleBudgetStats(
    transactions.filter((t) => !t.excludeFromAnalytics),
    budget,
    cycleType,
    cycleDay
  );

  const displayRemaining = Math.abs(remaining);

  // Calculate category spending stats
  const categoryStats = useMemo(() => {
    const stats = categories
      .filter((cat) => cat.id !== "all")
      .map((category) => {
        const catTransactions = transactions.filter(
          (t) => t.categoryId === category.id && t.kind === "expense" && !t.excludeFromAnalytics
        );
        const totalSpent = catTransactions.reduce((sum, t) => sum + t.amount, 0);
        return {
          ...category,
          totalSpent,
          count: catTransactions.length,
        };
      })
      .filter((cat) => cat.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const totalExpenses = stats.reduce((sum, cat) => sum + cat.totalSpent, 0);

    return stats.map((cat) => ({
      ...cat,
      percentage: totalExpenses > 0 ? (cat.totalSpent / totalExpenses) * 100 : 0,
    }));
  }, [categories, transactions]);

  // Group transactions by day
  const dailyTransactions = useMemo(() => {
    const grouped = new Map<string, Transaction[]>();
    
    transactions
      .filter(t => t.kind === "expense" && !t.excludeFromAnalytics)
      .forEach((t) => {
        const date = new Date(t.date);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        grouped.get(dateKey)!.push(t);
      });

    // Convert to array and sort by date descending
    return Array.from(grouped.entries())
      .map(([dateKey, txs]) => ({
        date: dateKey,
        transactions: txs,
        total: txs.reduce((sum, t) => sum + t.amount, 0),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Fixed Back button and Header */}
      <View className="bg-white px-5 pt-2 pb-6">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-2"
          >
            <Feather name="chevron-left" size={20} color="#7C3AED" />
            <Text className="text-primary text-base font-semibold">Back</Text>
          </Pressable>
          
          <Text className="text-xs text-gray-500">Budget Period</Text>
        </View>
        
        <View className="mt-1 items-end">
          <Text className="text-2xl font-bold text-dark-100">This Month</Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isDraggingChart}
      >

        {/* Spending Over Time Chart - Full Width */}
        <SpendingOverTimeChart
          transactions={transactions.filter((t) => !t.excludeFromAnalytics)}
          cycleType={cycleType}
          cycleDay={cycleDay}
          currency={summary?.currency}
          onDraggingChange={setIsDraggingChart}
          onDateSelected={setSelectedGraphDate}
        />

        {/* Remaining Spend Card - Non-clickable */}
        <View className="px-5 mt-5">
          <View className={`rounded-3xl ${isOverspent ? "bg-red-600" : "bg-primary"} px-5 py-6 shadow-md`}>
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
        </View>

        {/* Category Breakdown / Daily Transactions */}
        <TouchableWithoutFeedback onPress={() => showViewDropdown && setShowViewDropdown(false)}>
          <View className="mt-6 px-5 pb-6">
            <View className="relative">
              <Pressable 
                onPress={() => {
                  console.log("Header clicked, current dropdown state:", showViewDropdown);
                  setShowViewDropdown(!showViewDropdown);
                }}
                className="flex-row items-center justify-between mb-3 active:opacity-70"
              >
                <Text className={`text-lg font-bold ${showViewDropdown ? "text-gray-400" : "text-dark-100"}`}>
                  {viewMode === "category" ? "Spending by Category" : "Daily Transactions"}
                </Text>
                <Feather 
                  name={showViewDropdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color={showViewDropdown ? "#9CA3AF" : "#181C2E"}
                />
              </Pressable>

              {/* Dropdown Menu - Positioned absolutely below */}
              <Animated.View 
                pointerEvents={showViewDropdown ? 'auto' : 'none'}
                className="absolute top-full mt-2 rounded-2xl overflow-hidden z-50" 
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  shadowColor: '#7C3AED',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  elevation: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  opacity: dropdownAnim,
                  transform: [
                    {
                      scaleY: dropdownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                    {
                      scaleX: dropdownAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ],
                  transformOrigin: 'top',
                }}
              >
                <View style={{ backgroundColor: 'rgba(124, 58, 237, 0.08)' }}>
                  <Pressable
                    onPress={() => {
                      setViewMode("category");
                      setSelectedOption("category");
                      setShowViewDropdown(false);
                      setTimeout(() => setSelectedOption(null), 300);
                    }}
                    className={`px-6 py-4 border-b active:opacity-70 ${selectedOption === "category" ? "bg-purple-100" : ""}`}
                    style={{ borderBottomColor: 'rgba(124, 58, 237, 0.15)', borderBottomWidth: 1 }}
                  >
                    <Text className={`${viewMode === "category" ? "font-bold text-primary" : "text-dark-100"}`}>
                      Spending by Category
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setViewMode("daily");
                      setSelectedOption("daily");
                      setShowViewDropdown(false);
                      setTimeout(() => setSelectedOption(null), 300);
                    }}
                    className={`px-6 py-4 active:opacity-70 ${selectedOption === "daily" ? "bg-purple-100" : ""}`}
                  >
                    <Text className={`${viewMode === "daily" ? "font-bold text-primary" : "text-dark-100"}`}>
                      Daily Transactions
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>

          {/* Category View */}
          {viewMode === "category" && (
            categoryStats.length === 0 ? (
              <Text className="text-gray-400 text-sm">No spending data available</Text>
            ) : (
              <View className="gap-3">
                {categoryStats.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => router.push(`/transactions?filter=${cat.id}`)}
                    className="active:opacity-70"
                  >
                    <View className="flex-row items-center rounded-2xl bg-gray-50 px-4 py-4 border border-gray-100">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: cat.color || "#7C3AED" }}
                      >
                        <Feather name="shopping-bag" size={18} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-dark-100">{cat.name}</Text>
                        <Text className="text-xs text-gray-500 mt-1">
                          {cat.count} transaction{cat.count !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="font-bold text-red-500">
                          {formatCurrency(cat.totalSpent / 100, currency)}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-1">{cat.percentage.toFixed(1)}%</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          )}

          {/* Daily View */}
          {viewMode === "daily" && (
            selectedGraphDate === null ? (
              <Text className="text-gray-400 text-sm">Please select a date on the graph</Text>
            ) : (
              (() => {
                const selectedDay = dailyTransactions.find(d => d.date === selectedGraphDate);
                return selectedDay ? (
                  <View className="gap-3">
                    <View className="rounded-2xl bg-gray-50 px-4 py-4 border border-gray-100">
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="font-semibold text-dark-100">
                          {new Date(selectedDay.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Text>
                        <Text className="font-bold text-red-500">
                          {formatCurrency(selectedDay.total / 100, currency)}
                        </Text>
                      </View>
                      <View className="gap-2">
                        {selectedDay.transactions.map((tx) => {
                          const category = categories.find(c => c.id === tx.categoryId);
                          return (
                            <View key={tx.id} className="flex-row items-center justify-between">
                              <View className="flex-1 flex-row items-center gap-2">
                                <View
                                  className="w-6 h-6 rounded-full"
                                  style={{ backgroundColor: category?.color || "#7C3AED" }}
                                />
                                <Text className="text-sm text-dark-100 flex-1" numberOfLines={1}>
                                  {tx.title}
                                </Text>
                              </View>
                              <Text className="text-sm text-red-500 ml-2">
                                {formatCurrency(tx.amount / 100, currency)}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                ) : (
                  <Text className="text-gray-400 text-sm">No transactions on {new Date(selectedGraphDate).toLocaleDateString()}</Text>
                );
              })()
            )
          )}
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </SafeAreaView>
  );
}
