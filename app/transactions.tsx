import { useHomeStore } from "@/store/useHomeStore";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { formatCurrency } from "@/lib/currencyFunctions";

export default function AllTransactionsScreen() {
  const { transactions, categories } = useHomeStore();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedFilter === "all") return true;
      if (selectedFilter === "income" || selectedFilter === "expense") {
        return t.kind === selectedFilter;
      }
      // It's a category filter
      return t.categoryId === selectedFilter;
    });
  }, [transactions, selectedFilter]);

  const getTransactionIcon = (categoryId: string) => {
    const iconMap: { [key: string]: string } = {
      food: "shopping-bag",
      transport: "truck",
      shopping: "shopping-cart",
      bills: "file-text",
      entertainment: "film",
      default: "dollar-sign",
    };
    return iconMap[categoryId] || iconMap.default;
  };

  const getTransactionColor = (kind: "income" | "expense") => {
    return kind === "income" ? "#10B981" : "#EF4444";
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        {/* Header */}
        <View className="px-5 pt-4 pb-4 border-b border-gray-200">
          <Pressable
            onPress={() => router.back()}
            className="mb-4 flex-row items-center gap-2"
          >
            <Feather name="chevron-left" size={20} color="#7C3AED" />
            <Text className="text-primary text-base font-semibold">Back</Text>
          </Pressable>
          <Text className="text-3xl font-bold text-dark-100">All Transactions</Text>
          <Text className="text-sm text-gray-600 mt-1">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* Combined Filters */}
        <View className="px-5 py-3 border-b border-gray-100">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {/* All */}
              <Pressable
                onPress={() => setSelectedFilter("all")}
                className={`px-4 py-2 rounded-full ${
                  selectedFilter === "all" ? "bg-primary" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedFilter === "all" ? "text-white" : "text-gray-700"
                  }`}
                >
                  All
                </Text>
              </Pressable>

              {/* Income */}
              <Pressable
                onPress={() => setSelectedFilter("income")}
                className={`px-4 py-2 rounded-full ${
                  selectedFilter === "income" ? "bg-green-500" : "bg-green-100"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedFilter === "income" ? "text-white" : "text-green-700"
                  }`}
                >
                  Income
                </Text>
              </Pressable>

              {/* Expenses */}
              <Pressable
                onPress={() => setSelectedFilter("expense")}
                className={`px-4 py-2 rounded-full ${
                  selectedFilter === "expense" ? "bg-red-500" : "bg-red-100"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedFilter === "expense" ? "text-white" : "text-red-700"
                  }`}
                >
                  Expenses
                </Text>
              </Pressable>

              {/* Categories */}
              {categories
                .filter((cat) => cat.id !== "all")
                .map((cat) => {
                  const active = selectedFilter === cat.id;
                  const bg = active ? cat.color || "#7C3AED" : "#F3F4F6";
                  const textColor = active ? "#FFFFFF" : "#111827";
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedFilter(cat.id)}
                      className="px-4 py-2 rounded-full"
                      style={{ backgroundColor: bg }}
                    >
                      <Text className="text-sm font-semibold" style={{ color: textColor }}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </ScrollView>
        </View>

        {/* Transaction List */}
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item, index) => (item.id ? String(item.id) : String(index))}
          renderItem={({ item }) => (
            <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${getTransactionColor(item.kind)}20` }}
                >
                  <Feather
                    name={getTransactionIcon(item.categoryId) as any}
                    size={18}
                    color={getTransactionColor(item.kind)}
                  />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-dark-100 text-base">
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text className="text-xs text-gray-500 mt-1">{item.subtitle}</Text>
                  )}
                  <Text className="text-xs text-gray-400 mt-1">
                    {formatDate(item.date)}
                  </Text>
                </View>
              </View>
              <Text
                className="font-bold text-base"
                style={{ color: getTransactionColor(item.kind) }}
              >
                {item.kind === "income" ? "+" : "-"}
                {formatCurrency(item.amount / 100)}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Feather name="inbox" size={48} color="#D1D5DB" />
              <Text className="text-gray-400 text-base mt-4">No transactions found</Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}
