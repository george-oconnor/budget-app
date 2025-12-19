import { useEffect, useMemo } from "react";
import {
  FlatList,
  ScrollView,
  View,
  Text,
  Pressable,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import { useHomeStore } from "../store/useHomeStore";
import avatar from "../assets/images/avatar.png";

type QuickAction = {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

const quickActions: QuickAction[] = [
  { id: "send", label: "Send", icon: "arrow-up-right" },
  { id: "add", label: "Add", icon: "plus" },
  { id: "analytics", label: "Stats", icon: "bar-chart-2" },
];

const formatCurrency = (value: number, currency = "USD") => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (e) {
    return `${currency} ${value.toFixed(2)}`;
  }
};

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
        <Header />
        <BalanceCard summary={summary} loading={loading} />
        <CategoryChips
          categories={categories}
          selected={selectedCategory}
          onSelect={setCategory}
        />
        <QuickActions />
        <TransactionsSection
          transactions={filteredTx}
          currency={summary?.currency ?? "USD"}
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View className="flex-row items-center justify-between pt-4 pb-6">
      <View>
        <Text className="text-xs text-gray-500">Welcome back</Text>
        <Text className="text-2xl font-bold text-dark-100">Alex Morgan</Text>
      </View>
      <View className="flex-row items-center gap-3">
        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
          <Feather name="bell" size={18} color="#181C2E" />
        </Pressable>
        <Image source={avatar} className="h-10 w-10 rounded-full" />
      </View>
    </View>
  );
}

function BalanceCard({
  summary,
  loading,
}: {
  summary: ReturnType<typeof useHomeStore>["summary"];
  loading: boolean;
}) {
  const currency = summary?.currency ?? "USD";
  return (
    <View className="rounded-3xl bg-primary px-5 py-6 shadow-md">
      <Text className="text-white/80 text-sm">Total Balance</Text>
      <Text className="text-white text-4xl font-bold mt-1">
        {loading ? "…" : formatCurrency(summary?.balance ?? 0, currency)}
      </Text>
      <View className="flex-row justify-between mt-4">
        <Stat label="Income" value={summary?.income ?? 0} currency={currency} positive />
        <Stat label="Expenses" value={summary?.expenses ?? 0} currency={currency} />
      </View>
    </View>
  );
}

function Stat({
  label,
  value,
  currency,
  positive,
}: {
  label: string;
  value: number;
  currency: string;
  positive?: boolean;
}) {
  const color = positive ? "#2F9B65" : "#F14141";
  return (
    <View className="bg-white/10 rounded-2xl px-3 py-3 flex-1 mr-3 last:mr-0">
      <Text className="text-white/70 text-xs">{label}</Text>
      <View className="flex-row items-center gap-2 mt-1">
        <MaterialCommunityIcons
          name={positive ? "arrow-top-right" : "arrow-bottom-right"}
          size={16}
          color={color}
        />
        <Text className="text-white text-lg font-semibold">
          {formatCurrency(value, currency)}
        </Text>
      </View>
    </View>
  );
}

function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: ReturnType<typeof useHomeStore>["categories"];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-5"
      contentContainerStyle={{ gap: 10 }}
    >
      {categories.map((cat) => {
        const active = selected === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className={`px-4 py-2 rounded-full border ${
              active ? "bg-dark-100 border-dark-100" : "border-gray-200 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                active ? "text-white" : "text-dark-100"
              }`}
            >
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function QuickActions() {
  return (
    <View className="flex-row justify-between mt-5">
      {quickActions.map((action) => (
        <Pressable
          key={action.id}
          className="flex-1 mr-3 last:mr-0 items-center rounded-2xl bg-white py-3 shadow-sm border border-gray-100"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Feather name={action.icon} size={18} color="#FE8C00" />
          </View>
          <Text className="text-dark-100 font-semibold">{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function TransactionsSection({
  transactions,
  currency,
  loading,
}: {
  transactions: ReturnType<typeof useHomeStore>["transactions"];
  currency: string;
  loading: boolean;
}) {
  return (
    <View className="mt-6 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-dark-100">Recent Transactions</Text>
        <Pressable>
          <Text className="text-primary font-semibold">See all</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text className="text-gray-500">Loading…</Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TransactionRow transaction={item} currency={currency} />
          )}
          ListEmptyComponent={() => (
            <Text className="text-gray-500">No transactions yet.</Text>
          )}
        />
      )}
    </View>
  );
}

function TransactionRow({
  transaction,
  currency,
}: {
  transaction: ReturnType<typeof useHomeStore>["transactions"][number];
  currency: string;
}) {
  const isIncome = transaction.kind === "income";
  const amountColor = isIncome ? "text-green-600" : "text-red-500";
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-100">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <MaterialCommunityIcons
            name={isIncome ? "tray-arrow-down" : "tray-arrow-up"}
            size={20}
            color={isIncome ? "#2F9B65" : "#F14141"}
          />
        </View>
        <View>
          <Text className="text-base font-semibold text-dark-100">{transaction.title}</Text>
          <Text className="text-xs text-gray-500">{transaction.subtitle}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className={`text-base font-semibold ${amountColor}`}>
          {formatCurrency(transaction.amount, currency)}
        </Text>
        <Text className="text-xs text-gray-500">
          {new Date(transaction.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}
