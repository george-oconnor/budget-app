import { getTransactionsPaginated } from "@/lib/appwrite";
import { formatCurrency } from "@/lib/currencyFunctions";
import { getQueuedTransactions } from "@/lib/syncQueue";
import { useHomeStore } from "@/store/useHomeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useTransactionDetailStore } from "@/store/useTransactionDetailStore";
import type { Transaction } from "@/types/type";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GroupedTransaction = {
  type: "header" | "transaction";
  date?: string;
  dateLabel?: string;
  transaction?: Transaction;
  id: string;
};

export default function AllTransactionsScreen() {
  const { categories, summary } = useHomeStore();
  const { user } = useSessionStore();
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const currency = summary?.currency ?? "USD";

  // Apply filter from URL params on mount
  useEffect(() => {
    if (filter && (filter === "income" || filter === "expense" || filter === "all")) {
      setSelectedFilter(filter);
    }
  }, [filter]);

  // Load initial transactions
  useEffect(() => {
    loadTransactions(true);
  }, []);

  const loadTransactions = async (reset: boolean = false) => {
    if (!user?.id) return;
    
    if (reset) {
      setLoading(true);
      setTransactions([]);
      setCursor(undefined);
      setHasMore(true);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }

    try {
      const [result, queuedTxs] = await Promise.all([
        getTransactionsPaginated(user.id, 25, reset ? undefined : cursor),
        reset ? getQueuedTransactions() : Promise.resolve([]),
      ]);
      
      const newTransactions: Transaction[] = result.documents.map((t) => ({
        id: (t as any).$id ?? `${t.userId}-${t.date}`,
        title: t.title,
        subtitle: t.subtitle || "",
        amount: t.amount,
        categoryId: t.categoryId,
        kind: t.kind,
        date: t.date,
      }));

      // Add queued transactions (only on reset/initial load)
      if (reset) {
        const userQueuedTxs = queuedTxs.filter(t => t.userId === user.id);
        const queuedTransactions: Transaction[] = userQueuedTxs.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.subtitle,
          amount: t.amount,
          categoryId: t.categoryId,
          kind: t.kind,
          date: t.date,
        }));

        // Combine and sort by date (most recent first)
        const combined = [...newTransactions, ...queuedTransactions].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        setTransactions(combined);
      } else {
        setTransactions(prev => [...prev, ...newTransactions]);
      }

      setHasMore(result.hasMore);
      setCursor(result.lastCursor);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (hasMore && !loadingMore && !loading) {
      loadTransactions(false);
    }
  }, [hasMore, loadingMore, loading, cursor]);

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

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time parts for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (dateOnly.getTime() === todayOnly.getTime()) {
      return "Today";
    } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Group transactions by date
  const groupedData = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const grouped: GroupedTransaction[] = [];
    let currentDate = "";

    sorted.forEach((transaction) => {
      const transactionDate = new Date(transaction.date).toDateString();
      
      if (transactionDate !== currentDate) {
        currentDate = transactionDate;
        grouped.push({
          type: "header",
          date: transaction.date,
          dateLabel: formatDateHeader(transaction.date),
          id: `header-${transaction.date}`,
        });
      }

      grouped.push({
        type: "transaction",
        transaction,
        id: transaction.id || `transaction-${Math.random()}`,
      });
    });

    return grouped;
  }, [filteredTransactions]);

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
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#7C3AED" />
          </View>
        ) : (
          <FlatList
            data={groupedData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              if (item.type === "header") {
                return (
                  <View className="px-5 pt-4 pb-2 bg-gray-50">
                    <Text className="font-semibold text-sm text-gray-700">
                      {item.dateLabel}
                    </Text>
                  </View>
                );
              }

              const transaction = item.transaction!;
              const category = categories.find((cat) => cat.id === transaction.categoryId);
              return (
                <Pressable
                  onPress={() => {
                    console.log("Transaction ID being set:", transaction.id, "Length:", transaction.id.length);
                    useTransactionDetailStore.getState().setSelectedTransactionId(transaction.id);
                    router.push("/transaction-detail");
                  }}
                  className="active:opacity-70"
                >
                  <View className="px-5 py-4 border-b border-gray-100 flex-row items-center justify-between bg-white">
                    <View className="flex-row items-center flex-1">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: `${getTransactionColor(transaction.kind)}20` }}
                      >
                        <Feather
                          name={getTransactionIcon(transaction.categoryId) as any}
                          size={18}
                          color={getTransactionColor(transaction.kind)}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-dark-100 text-base">
                          {transaction.title}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-1">
                          {category?.name || "Uncategorized"}
                        </Text>
                        <Text className="text-xs text-gray-400 mt-1">
                          {formatDateHeader(transaction.date)} • {formatTime(transaction.date)}
                        </Text>
                      </View>
                    </View>
                    <Text
                      className="font-bold text-base"
                      style={{ color: getTransactionColor(transaction.kind) }}
                    >
                      {transaction.kind === "income" ? "+" : "-"}
                      {formatCurrency(transaction.amount / 100, currency)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Feather name="inbox" size={48} color="#D1D5DB" />
                <Text className="text-gray-400 text-base mt-4">No transactions found</Text>
              </View>
            }
            ListFooterComponent={
              loadingMore ? (
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#7C3AED" />
                </View>
              ) : null
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ flexGrow: 1 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
