import TransactionRow from "@/components/TransactionRow";
import type { Category, Transaction } from "@/types/type";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

export default function TransactionsSection({
  transactions,
  currency,
  categories,
  loading,
}: {
  transactions: Transaction[];
  currency: string;
  categories: Category[];
  loading: boolean;
}) {
  const topTransactions = transactions.slice(0, 5);

  return (
    <View className="mt-6 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-dark-100">Recent Transactions</Text>
        <Pressable onPress={() => router.push("/transactions")}>
          <Text className="text-primary font-semibold">See all</Text>
        </Pressable>
      </View>
      {loading ? (
        <Text className="text-gray-500">Loading…</Text>
      ) : (
        <FlatList
          data={topTransactions}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => {
            const category = categories.find((c) => c.id === item.categoryId);
            return (
              <TransactionRow
                transaction={item}
                currency={currency}
                categoryName={category?.name}
              />
            );
          }}
          ListEmptyComponent={() => (
            <Text className="text-gray-500">No transactions yet.</Text>
          )}
        />
      )}

      {!loading && topTransactions.length > 0 && transactions.length > 5 && (
        <View className="mt-3">
          <Pressable
            onPress={() => router.push("/transactions")}
            className="w-full items-center justify-center py-3 rounded-xl bg-gray-100 active:opacity-80"
          >
            <Text className="text-primary font-semibold">See more</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
