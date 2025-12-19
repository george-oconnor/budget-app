import { FlatList, Text, View } from "react-native";
import type { Transaction, Category } from "@/types/type";
import TransactionRow from "@/components/TransactionRow";

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
  return (
    <View className="mt-6 mb-4">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-bold text-dark-100">Recent Transactions</Text>
        <Text className="text-primary font-semibold">See all</Text>
      </View>
      {loading ? (
        <Text className="text-gray-500">Loading…</Text>
      ) : (
        <FlatList
          data={transactions}
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
    </View>
  );
}
